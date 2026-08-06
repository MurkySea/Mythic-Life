'use server'

import { createClient } from '@/utils/supabase/server'
import { after } from 'next/server'
import {
  XP_PER_DOMAIN,
  skillLevelFromXp,
  parseDomains,
  type SkillKey,
} from '@/lib/skills'
import {
  COMPANION_DEFS,
  meetsUnlock,
  getCompanionDef,
} from '@/lib/companions'
import {
  buildCompanionSystemPrompt,
  buildCompanionUserPrompt,
  pickMood,
  replyTokenBudget,
  USER_NAME,
} from '@/lib/companionVoice'
import {
  loadPersistedMood,
  savePersistedMood,
  continueMood,
  moodForceFromUserText,
} from '@/lib/mood'
import {
  maybeCaptureMemory,
  loadBestMemories,
  maybeRecordAbsence,
  companionPrivateFocus,
  curiosityWhenThin,
} from '@/lib/memory'
import {
  buildCompanionRewritePrompt,
  assessEvidenceOfAttention,
  assessCuriosityIntent,
  characterEnginePromptBlock,
  formatKnowledgeBlock,
  generateCompanionWithQualityLoop,
  loadCompanionKnowledge,
  maybeWriteKnowledge,
  runCharacterEngine,
  type CompanionDraftContext,
  type ConversationDirection,
  hydrateCharacterState,
  applyConversationOutcome,
  legacyMemory,
  localDateFor,
  type CharacterState,
  type CompanionMemory,
} from '@/lib/character-engine'

function normalizeAffinities(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function getLocalYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getYesterdayYmd(): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(yesterday)
}

function getLocalWeekdayKey(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
  })
    .format(new Date())
    .toLowerCase()
    .slice(0, 3)
}

function localHourChicago(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10
  )
}

async function loadLiveCharacterState(opts: {
  companionSlug: string
  companionId?: string
  now: Date
}): Promise<{ state: CharacterState; rowId?: string; userId?: string }> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId || !opts.companionId) {
    return { state: hydrateCharacterState({ companionSlug: opts.companionSlug, now: opts.now }) }
  }
  try {
    const { data, error } = await supabase
      .from('companion_character_state')
      .select('id, companion_slug, state, updated_at')
      .eq('user_id', userId)
      .eq('companion_id', opts.companionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return {
      state: hydrateCharacterState({ companionSlug: opts.companionSlug, row: data, now: opts.now }),
      rowId: data?.id,
      userId,
    }
  } catch (error) {
    console.error('load companion character state failed', error)
    return { state: hydrateCharacterState({ companionSlug: opts.companionSlug, now: opts.now }), userId }
  }
}

async function saveLiveCharacterState(opts: {
  state: CharacterState
  companionId?: string
  rowId?: string
  userId?: string
}): Promise<void> {
  if (!opts.companionId || !opts.userId) return
  const supabase = await createClient()
  const payload = {
    user_id: opts.userId,
    companion_id: opts.companionId,
    companion_slug: opts.state.companionSlug,
    state: opts.state,
    version: opts.state.version,
    updated_at: opts.state.updatedAt,
  }
  try {
    const result = opts.rowId
      ? await supabase.from('companion_character_state').update(payload).eq('id', opts.rowId)
      : await supabase.from('companion_character_state').insert(payload)
    if (result.error) throw result.error
  } catch (error) {
    console.error('save companion character state failed', error)
  }
}

async function loadStructuredCompanionMemories(companionSlug: string, now: Date): Promise<CompanionMemory[]> {
  const supabase = await createClient()
  try {
    const { data, error } = await supabase
      .from('companion_memories')
      .select('id, kind, summary, content, created_at, importance_score, confidence_score, tags, expires_at, last_recalled_at, recall_count')
      .eq('companion_slug', companionSlug)
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
      .order('importance_score', { ascending: false })
      .limit(40)
    if (error) throw error
    return (data || []).map((row, index) => {
      const summary = String(row.summary || row.content || '').trim()
      const adapted = legacyMemory(summary, index, new Date(row.created_at || now))
      const kind = ['factual', 'episodic', 'relational', 'growth', 'open_loop', 'sensitive'].includes(row.kind)
        ? row.kind as CompanionMemory['type']
        : adapted.type
      const recalledAt = row.last_recalled_at ? new Date(row.last_recalled_at) : null
      const recallCount = Math.max(0, Number(row.recall_count || 0))
      return {
        ...adapted,
        id: String(row.id || adapted.id),
        type: kind,
        salience: Math.max(0, Math.min(1, Number(row.importance_score ?? 55) / 100)),
        emotionalWeight: Math.max(0, Math.min(1, Number(row.confidence_score ?? 45) / 100)),
        topics: Array.isArray(row.tags) ? row.tags.map(String).slice(0, 8) : adapted.topics,
        unresolved: kind === 'open_loop' ? true : adapted.unresolved,
        retrievalCount: recallCount,
        lastRetrievedAt: recalledAt?.toISOString(),
        cooldownUntil: recalledAt && recallCount > 0
          ? new Date(recalledAt.getTime() + Math.min(7, recallCount) * 12 * 3_600_000).toISOString()
          : undefined,
      }
    }).filter((memory) => memory.summary)
  } catch (error) {
    console.error('load structured companion memories failed', error)
    return []
  }
}

async function markMemoriesRetrieved(memories: CompanionMemory[], now: Date): Promise<void> {
  const persistedMemories = memories.filter((memory) => !memory.id.startsWith('scene-open-loop-'))
  if (!persistedMemories.length) return
  const supabase = await createClient()
  await Promise.all(persistedMemories.map(async (memory) => {
    const { error } = await supabase.from('companion_memories').update({
      last_recalled_at: now.toISOString(),
      recall_count: memory.retrievalCount + 1,
    }).eq('id', memory.id)
    if (error) console.error('mark companion memory retrieved failed', { id: memory.id, error })
  }))
}

export async function updateTaskStreak(taskId: string) {
  const supabase = await createClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('id, recurrence, streak_count, last_streak_date')
    .eq('id', taskId)
    .single()

  if (!task) return { streak: 0 }
  if (task.recurrence !== 'daily' && task.recurrence !== 'weekly') {
    return { streak: task.streak_count || 0 }
  }

  const today = getLocalYmd()
  const yesterday = getYesterdayYmd()
  const last = task.last_streak_date as string | null
  const prev = task.streak_count || 0
  let next = 1
  if (last === today) next = prev
  else if (last === yesterday) next = prev + 1
  else next = 1

  await supabase
    .from('tasks')
    .update({ streak_count: next, last_streak_date: today })
    .eq('id', taskId)

  return { streak: next }
}

export async function awardSkillXp(domains: string[]) {
  const supabase = await createClient()
  const keys = parseDomains(domains.join(','))
  const levels: Record<string, number> = {}
  const skillGains: { skill: string; xpAdded: number; level: number }[] = []

  for (const skill of keys) {
    const { data: row } = await supabase
      .from('player_skills')
      .select('skill, xp')
      .eq('skill', skill)
      .maybeSingle()

    const prevXp = row?.xp || 0
    const newXp = prevXp + XP_PER_DOMAIN
    const level = skillLevelFromXp(newXp)

    await supabase.from('player_skills').upsert({
      skill,
      xp: newXp,
      level,
    })

    levels[skill] = level
    skillGains.push({ skill, xpAdded: XP_PER_DOMAIN, level })
  }

  const { data: all } = await supabase.from('player_skills').select('skill, xp, level')
  const full: Record<string, number> = {}
  for (const r of all || []) {
    full[r.skill] = r.level || skillLevelFromXp(r.xp || 0)
  }
  for (const [k, v] of Object.entries(levels)) full[k] = v

  const newlyUnlocked = await checkAndUnlockCompanions(full)
  return { levels: full, newlyUnlocked, skillGains }
}

export async function checkAndUnlockCompanions(levels?: Record<string, number>) {
  const supabase = await createClient()

  let levelMap = levels
  if (!levelMap) {
    const { data: all } = await supabase.from('player_skills').select('skill, level, xp')
    levelMap = {}
    for (const r of all || []) {
      levelMap[r.skill] = r.level || skillLevelFromXp(r.xp || 0)
    }
  }

  const newly: string[] = []

  for (const def of COMPANION_DEFS) {
    const canUnlock = def.starter || meetsUnlock(def.unlock, levelMap)
    if (!canUnlock) continue

    const { data: existing } = await supabase
      .from('companion')
      .select('id, is_unlocked, slug, name')
      .or(`slug.eq.${def.slug},name.eq.${def.name}`)
      .maybeSingle()

    const affinitiesValue = def.affinities

    if (existing) {
      const wasLocked = existing.is_unlocked === false
      if (wasLocked || existing.is_unlocked == null) {
        await supabase
          .from('companion')
          .update({
            is_unlocked: true,
            slug: def.slug,
            title: def.title,
            personality: def.personality,
            affinities: affinitiesValue,
          })
          .eq('id', existing.id)
        if (!def.starter && wasLocked) newly.push(def.slug)
        if (!def.starter && existing.is_unlocked == null && existing.slug !== def.slug) {
          newly.push(def.slug)
        }
      } else if (!existing.slug) {
        await supabase
          .from('companion')
          .update({ slug: def.slug, affinities: affinitiesValue })
          .eq('id', existing.id)
      }
    } else {
      await supabase.from('companion').insert({
        name: def.name,
        slug: def.slug,
        title: def.title,
        personality: def.personality,
        affinities: affinitiesValue,
        is_unlocked: true,
        affinity_score: 1,
        bond_xp: 0,
      })
      if (!def.starter) newly.push(def.slug)
    }
  }

  const { data: sera } = await supabase
    .from('companion')
    .select('id, slug')
    .or('slug.eq.seraphine,name.eq.Seraphine')
    .maybeSingle()

  if (!sera) {
    await supabase.from('companion').insert({
      name: 'Seraphine',
      slug: 'seraphine',
      title: 'Quiet Flame',
      personality: COMPANION_DEFS[0].personality,
      affinities: ['faith', 'discipline'],
      is_unlocked: true,
      affinity_score: 1,
      bond_xp: 0,
    })
  } else if (!sera.slug) {
    await supabase
      .from('companion')
      .update({
        slug: 'seraphine',
        is_unlocked: true,
        affinities: ['faith', 'discipline'],
      })
      .eq('id', sera.id)
  }

  return newly
}

export async function postUnlockCeremony(slugs: string[]) {
  const supabase = await createClient()
  const details: { name: string; slug: string; emoji: string; line: string }[] = []

  for (const slug of slugs) {
    const def = getCompanionDef(slug)
    if (!def || def.starter) continue

    const line = def.unlockLine
    await supabase.from('messages').insert({
      role: 'companion',
      content: line,
      companion_slug: slug,
    })

    details.push({
      name: def.name,
      slug: def.slug,
      emoji: def.emoji,
      line,
    })
  }

  return details
}

export async function getScenePrompt(affinity: number): Promise<string> {
  const { buildScenePrompt } = await import('@/lib/scenes')
  return buildScenePrompt(affinity, null, 0)
}

async function buildObservationBlock(companionSlug: string): Promise<string> {
  const supabase = await createClient()
  const lines: string[] = []

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select('title, is_completed, completed_at, streak_count, domains, domain')
      .gte('completed_at', weekAgo)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false })
      .limit(40)

    const completed = recentTasks || []
    if (completed.length >= 8) {
      lines.push('He has been consistently showing up this week — more than usual.')
    } else if (completed.length >= 4) {
      lines.push('He has been reasonably consistent the last few days.')
    } else if (completed.length <= 1) {
      lines.push('He has been quieter than usual the past few days. Less activity.')
    }

    const strongStreaks = completed.filter((t) => (t.streak_count || 0) >= 4)
    if (strongStreaks.length > 0) {
      lines.push('He has kept at least one promise for several days running.')
    }

    const domainCount: Record<string, number> = {}
    for (const t of completed) {
      const domains = parseDomains(t.domains, t.domain)
      for (const d of domains) {
        domainCount[d] = (domainCount[d] || 0) + 1
      }
    }
    const sorted = Object.entries(domainCount).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0 && sorted[0][1] >= 4) {
      const top = sorted[0][0]
      if (top === 'discipline' || top === 'fitness') {
        lines.push('He has been pushing hard on structure and effort lately.')
      } else if (top === 'faith') {
        lines.push('He has been leaning into faith and quiet practice more than usual.')
      } else if (top === 'knowledge') {
        lines.push('He has been feeding his mind — reading, learning, thinking.')
      } else if (top === 'relations') {
        lines.push('He has been putting energy into people and relationships.')
      }
    }

    const { data: lastMsgs } = await supabase
      .from('messages')
      .select('created_at, role, companion_slug')
      .order('created_at', { ascending: false })
      .limit(30)

    const thread = (lastMsgs || []).filter((m) => {
      if (companionSlug === 'seraphine') {
        return !m.companion_slug || m.companion_slug === 'seraphine'
      }
      return m.companion_slug === companionSlug
    })

    if (thread.length > 0) {
      const last = new Date(thread[0].created_at).getTime()
      const hoursSilent = (Date.now() - last) / (1000 * 60 * 60)
      if (hoursSilent > 36) {
        lines.push('He has been quieter with her than usual. A noticeable gap.')
      } else if (hoursSilent > 18) {
        lines.push('It has been a while since they last spoke.')
      }
    }

    const { data: comp } = await supabase
      .from('companion')
      .select('affinity_score, bond_xp')
      .or(`slug.eq.${companionSlug},name.eq.Seraphine`)
      .maybeSingle()

    const aff = comp?.affinity_score || 1
    if (aff >= 12) {
      lines.push('The bond between them is no longer new. There is real history now.')
    } else if (aff >= 6) {
      lines.push('Trust is forming. They are past the early careful stage.')
    }
  } catch (e) {
    console.error('observation build failed', e)
  }

  if (lines.length === 0) {
    return '(Nothing strong to notice yet. Learn him from what he actually says and does.)'
  }

  return lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
}

export async function generateCompanionResponse(
  taskTitle: string,
  domain: string = '',
  options: {
    force?: boolean
    isConversation?: boolean
    streak?: number
    companionSlug?: string
  } = {}
) {
  const {
    force = false,
    isConversation = false,
    streak = 0,
    companionSlug = 'seraphine',
  } = options

  if (!force && !isConversation) {
    if (Math.random() > 0.35) return null
  }

  const supabase = await createClient()
  const now = new Date()
  const def = getCompanionDef(companionSlug)

  const { data: companion } = await supabase
    .from('companion')
    .select('*')
    .or(`slug.eq.${companionSlug},name.eq.${def?.name || 'Seraphine'}`)
    .maybeSingle()

  const affinity = companion?.affinity_score || 1
  const displayName = companion?.name || def?.name || 'Seraphine'

  const { data: recent } = await supabase
    .from('messages')
    .select('role, content, companion_slug, created_at')
    .order('created_at', { ascending: false })
    .limit(24)

  const thread = (recent || [])
    .filter((m) => {
      if (companionSlug === 'seraphine') {
        return !m.companion_slug || m.companion_slug === 'seraphine'
      }
      return m.companion_slug === companionSlug
    })
    .reverse()

  const today = localDateFor(now, 'America/Chicago')
  const currentDayThread = thread.filter((message) => {
    const createdAt = new Date(message.created_at || 0)
    return Number.isFinite(createdAt.getTime()) && localDateFor(createdAt, 'America/Chicago') === today
  })

  const historyBlock =
    currentDayThread.length > 0
      ? currentDayThread
          .map((m) => {
            const who = m.role === 'user' ? USER_NAME : displayName
            return `${who}: ${m.content}`
          })
          .join('\n')
      : '(Little shared history yet. Do not force intimacy.)'

  const lastUser = [...thread].reverse().find((m) => m.role === 'user')?.content
  const lastCompanion = [...thread].reverse().find((m) => m.role === 'companion')?.content

  const memoryLines = await loadBestMemories(companionSlug, 14)
  const structuredMemories = await loadStructuredCompanionMemories(companionSlug, now)
  const absenceNote = await maybeRecordAbsence(companionSlug)
  const privateFocus = companionPrivateFocus(companionSlug)
  const curiosity = curiosityWhenThin(memoryLines.length)

  const knowledgeLines = await loadCompanionKnowledge(companionSlug, 8)
  const knowledgeBlock = formatKnowledgeBlock(knowledgeLines)

  if (isConversation) {
    await maybeCaptureMemory(companionSlug, taskTitle)
  }

  const observationBlock = await buildObservationBlock(companionSlug)

  const userText = isConversation ? taskTitle : lastUser || ''
  const candidate = pickMood({
    affinity,
    hour: localHourChicago(),
    lastUserText: userText,
    lastCompanionText: lastCompanion,
  })

  const persisted = await loadPersistedMood(companion?.id)
  const forceMood = moodForceFromUserText(userText)
  const mood = continueMood(persisted?.mood, candidate, forceMood)

  const maxTokens = replyTokenBudget(taskTitle, affinity)
  const depthMode = maxTokens >= 220

  let conversationEngine: ReturnType<typeof runCharacterEngine> | undefined
  const persistedState = await loadLiveCharacterState({
    companionSlug,
    companionId: companion?.id,
    now,
  })
  if (isConversation) {
    const engine = runCharacterEngine({
      companionSlug,
      userText: taskTitle,
      affinity,
      hour: localHourChicago(),
      recentHistory: historyBlock,
      def,
      knowledgeLines,
      state: persistedState.state,
      now,
      timeZone: 'America/Chicago',
      memories: structuredMemories.length
        ? structuredMemories
        : memoryLines.map((line, index) => legacyMemory(line, index, now)),
    })
    const curiosityIntent = assessCuriosityIntent({
      companionSlug,
      knowledgeLines,
      affinity,
      state: engine.state,
      disclosureDepth: engine.direction.disclosure.depth,
      isCorrection: engine.analysis.isCorrection,
      isVulnerable: engine.analysis.isVulnerable,
      userTextLength: taskTitle.length,
      recentCompanionText: lastCompanion,
    })
    const attentionIntent = assessEvidenceOfAttention({
      companionSlug,
      currentUserMessage: taskTitle,
      recentTurns: thread.map((message) => ({
        role: message.role === 'user' ? 'user' : 'companion',
        content: message.content,
      })),
      knowledgeLines,
      analysis: engine.analysis,
      direction: engine.direction,
      affinity,
      state: engine.state,
      curiosityActive: curiosityIntent.active,
    })

    conversationEngine = {
      ...engine,
      promptBlock: characterEnginePromptBlock({
        analysis: engine.analysis,
        decision: engine.decision,
        direction: engine.direction,
        state: engine.state,
        curiosity: curiosityIntent.active ? curiosityIntent : undefined,
        attention: attentionIntent.active ? attentionIntent : undefined,
      }),
    }
  }

  const memoryParts: string[] = []
  if (isConversation) {
    memoryParts.push(...(conversationEngine?.relevantMemories.map((memory) => memory.summary) ?? []))
  } else {
    memoryParts.push(...memoryLines.slice(0, 3))
    if (absenceNote) memoryParts.push(`(Private) ${absenceNote}`)
    if (curiosity) memoryParts.push(`(Curiosity) ${curiosity}`)
    memoryParts.push(`(Her private focus) ${privateFocus}`)
  }
  const memoryBlock = memoryParts.length
    ? `${memoryParts.map((memory, index) => `${index + 1}. ${memory}`).join('\n')}\n\nSelected relevant context only. Use it naturally; frame it as a callback only when the director authorizes a callback.`
    : '(No memory selected for this turn. Do not introduce a callback.)'

  const effectiveKnowledgeBlock = isConversation
    ? '(No broad knowledge dump. Use only the director-selected memory or explicit curiosity/attention target.)'
    : knowledgeBlock

  const systemRules = buildCompanionSystemPrompt({
    def, displayName, affinity, mood, memoryBlock, historyBlock,
    observationBlock, knowledgeBlock: effectiveKnowledgeBlock, depthMode,
  })

  const userPrompt = buildCompanionUserPrompt({
    displayName,
    isConversation,
    triggerText: taskTitle,
    streak,
    mood,
    depthMode,
    engine: conversationEngine,
  })

  const temperature = 0.88 + Math.random() * 0.12

  const sanitizeReply = (value: string) =>
    String(value || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(new RegExp(`^${displayName}\\s*:\\s*`, 'i'), '')
      .replace(/^\\*[^*]+\\*\\s*/g, '')
      .trim()

  const requestDraft = async (context?: CompanionDraftContext): Promise<string> => {
    const rewritePrompt = context ? buildCompanionRewritePrompt(context) : ''
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [
          { role: 'system', content: systemRules },
          {
            role: 'user',
            content: rewritePrompt ? `${userPrompt}\n\n${rewritePrompt}` : userPrompt,
          },
        ],
        temperature: context && context.attempt > 1 ? 0.72 : temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      throw new Error(`Grok API returned ${response.status}`)
    }

    const data = await response.json()
    return sanitizeReply(data.choices?.[0]?.message?.content || '')
  }

  let conversationDirection: ConversationDirection | undefined
  let persistedMessage: string | undefined
  let nextCharacterState: CharacterState | undefined
  try {
    let message: string

    if (isConversation) {
      const engine = conversationEngine!
      conversationDirection = engine.direction

      after(() =>
        maybeWriteKnowledge({
          companionSlug,
          userText: taskTitle,
          analysis: engine.analysis,
          disclosure: engine.direction.disclosure,
        })
      )

      const result = await generateCompanionWithQualityLoop({
        direction: engine.direction,
        maxAttempts: 3,
        generate: requestDraft,
      })

      message = sanitizeReply(result.reply)
      const advanced = applyConversationOutcome(engine.state, {
        positive: true,
        correction: engine.analysis.isCorrection,
        vulnerable: engine.analysis.isVulnerable,
        playful: engine.analysis.intent === 'humor',
        romantic: engine.analysis.isExplicitFlirtation,
        event: `Conversation about ${engine.direction.topic}`,
      }, now)
      nextCharacterState = {
        ...advanced,
        scene: {
          ...advanced.scene,
          status: 'active',
          topicIds: [...new Set([...advanced.scene.topicIds, engine.direction.topic])].slice(-6),
          unresolvedObligations: engine.direction.callbackAllowed && engine.direction.topicSource === 'open_loop'
            ? advanced.scene.unresolvedObligations
            : [],
        },
      }

      if (result.attempts > 1) {
        console.info('Companion reply rewritten by quality loop', {
          companionSlug,
          attempts: result.attempts,
          score: result.quality.score,
        })
      }
      console.info('Companion pipeline decision', {
        ...engine.observability,
        qualityViolations: result.quality.violations ?? [],
        rewriteAttempted: result.attempts > 1,
      })
    } else {
      message = (await requestDraft()) || `I noticed.`
    }

    const { error: messageInsertError } = await supabase.from('messages').insert({
      role: 'companion',
      content: message,
      companion_slug: companionSlug,
    })
    if (messageInsertError) throw messageInsertError
    persistedMessage = message

    if (nextCharacterState) {
      after(() => saveLiveCharacterState({
        state: nextCharacterState!,
        companionId: companion?.id,
        rowId: persistedState.rowId,
        userId: persistedState.userId,
      }))
    }
    if (conversationEngine?.relevantMemories.length) {
      after(() => markMemoriesRetrieved(conversationEngine!.relevantMemories, now))
    }

    await savePersistedMood(companion?.id, mood)

    return message
  } catch (error) {
    console.error('Companion response error:', error)
    if (persistedMessage) return persistedMessage

    let fallback = `I noticed.`
    if (isConversation) {
      const direction = conversationDirection ?? runCharacterEngine({
        companionSlug,
        userText: taskTitle,
        affinity,
        hour: localHourChicago(),
        recentHistory: historyBlock,
        def,
        knowledgeLines,
      }).direction
      const qualifiedFallback = await generateCompanionWithQualityLoop({
        direction,
        maxAttempts: 1,
        generate: async () =>
          `I don't want to answer you with something empty. Tell me what feels most important in this moment.`,
      })
      fallback = sanitizeReply(qualifiedFallback.reply)
    }
    const { error: fallbackInsertError } = await supabase.from('messages').insert({
      role: 'companion',
      content: fallback,
      companion_slug: companionSlug,
    })
    if (fallbackInsertError) throw fallbackInsertError
    return fallback
  }
}

export async function generateSeraphineResponse(
  taskTitle: string,
  domain: string = '',
  options: { force?: boolean; isConversation?: boolean; streak?: number } = {}
) {
  return generateCompanionResponse(taskTitle, domain, {
    ...options,
    companionSlug: 'seraphine',
  })
}

export async function awardBondProgress(
  domain: string = '',
  streak: number = 0,
  companionSlug: string = 'seraphine'
) {
  const supabase = await createClient()
  const def = getCompanionDef(companionSlug)

  const { data: companion } = await supabase
    .from('companion')
    .select('id, bond_xp, affinity_score')
    .or(`slug.eq.${companionSlug},name.eq.${def?.name || 'Seraphine'}`)
    .maybeSingle()

  if (!companion) return { xpGained: 0, affinityIncreased: false }

  const baseXp = 10
  const domainBonus = domain ? 3 : 0
  const streakBonus = streak >= 7 ? 8 : streak >= 3 ? 4 : 0
  const xpGained = baseXp + domainBonus + streakBonus

  const currentXp = companion.bond_xp || 0
  const newXp = currentXp + xpGained
  const oldTier = Math.floor(currentXp / 35)
  const newTier = Math.floor(newXp / 35)
  const affinityIncrease = Math.max(0, newTier - oldTier)
  const newAffinity = (companion.affinity_score || 1) + affinityIncrease

  await supabase
    .from('companion')
    .update({ bond_xp: newXp, affinity_score: newAffinity })
    .eq('id', companion.id)

  return {
    xpGained,
    affinityIncreased: affinityIncrease > 0,
    newAffinity,
    newXp,
  }
}

export async function pickReactingCompanion(domains: SkillKey[]): Promise<string> {
  const supabase = await createClient()
  const { data: unlocked } = await supabase
    .from('companion')
    .select('slug, name, affinities, is_unlocked')

  const list = (unlocked || []).filter((c) => c.is_unlocked !== false)
  if (list.length === 0) return 'seraphine'

  const scored = list.map((c) => {
    const slug = c.slug || (c.name === 'Seraphine' ? 'seraphine' : '')
    const def = getCompanionDef(slug)
    const aff = normalizeAffinities(c.affinities).length
      ? normalizeAffinities(c.affinities)
      : def?.affinities || []
    const overlap = domains.filter((d) => aff.includes(d)).length
    return { slug: slug || 'seraphine', overlap }
  })

  scored.sort((a, b) => b.overlap - a.overlap)
  if (scored[0].overlap > 0) return scored[0].slug
  return scored[Math.floor(Math.random() * scored.length)]?.slug || 'seraphine'
}

function getLocalDayStartISO(): string {
  const timeZone = 'America/Chicago'
  const chicagoYmd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const testDate = new Date(`${chicagoYmd}T12:00:00Z`)
  const hourInChicago = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(testDate),
    10
  )
  const offsetHours = 12 - hourInChicago
  const midnightUTC = new Date(`${chicagoYmd}T00:00:00Z`)
  midnightUTC.setUTCHours(midnightUTC.getUTCHours() + offsetHours)
  return midnightUTC.toISOString()
}

export async function ensureRecurringTasks() {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = getLocalDayStartISO()
  const todayWd = getLocalWeekdayKey()

  const { data: completedDaily } = await supabase
    .from('tasks')
    .select('id')
    .eq('recurrence', 'daily')
    .eq('is_completed', true)
    .lt('completed_at', todayStart)

  if (completedDaily && completedDaily.length > 0) {
    await supabase
      .from('tasks')
      .update({ is_completed: false, is_today: true })
      .in(
        'id',
        completedDaily.map((t) => t.id)
      )
  }

  await supabase
    .from('tasks')
    .update({ is_today: true })
    .eq('recurrence', 'daily')
    .eq('is_completed', false)

  const { data: weeklyTasks } = await supabase
    .from('tasks')
    .select('id, weekdays, is_completed, completed_at')
    .eq('recurrence', 'weekly')

  if (weeklyTasks && weeklyTasks.length > 0) {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    for (const task of weeklyTasks) {
      const days =
        task.weekdays && typeof task.weekdays === 'string' && task.weekdays.trim()
          ? task.weekdays.split(',').map((d: string) => d.trim())
          : []

      if (days.length > 0) {
        const isScheduledToday = days.includes(todayWd)
        if (isScheduledToday) {
          const completedBeforeToday =
            task.is_completed && task.completed_at && task.completed_at < todayStart
          if (completedBeforeToday) {
            await supabase
              .from('tasks')
              .update({ is_completed: false, is_today: true })
              .eq('id', task.id)
          } else if (!task.is_completed) {
            await supabase.from('tasks').update({ is_today: true }).eq('id', task.id)
          }
        } else {
          await supabase.from('tasks').update({ is_today: false }).eq('id', task.id)
        }
      } else if (task.is_completed && task.completed_at && task.completed_at < weekAgo) {
        await supabase
          .from('tasks')
          .update({ is_completed: false, is_today: true })
          .eq('id', task.id)
      }
    }
  }

  try {
    await checkAndUnlockCompanions()
  } catch (e) {
    console.error('unlock check failed', e)
  }
}
