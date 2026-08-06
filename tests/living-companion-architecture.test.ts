import { describe, expect, it } from 'vitest'
import {
  coreIdentityFor,
  createDefaultCharacterState,
  evaluateBehaviorFixture,
  evaluateCompanionReply,
  explicitlyRequestsCallback,
  initializeDailyState,
  hydrateCharacterState,
  legacyMemory,
  localDateFor,
  retrieveRelevantMemories,
  rollDailyBoundary,
  runCharacterEngine,
  selectInnerLifeInitiative,
  type CompanionMemory,
} from '@/lib/character-engine'

const yesterday = new Date('2026-08-03T14:00:00.000Z')
const today = new Date('2026-08-04T14:00:00.000Z')

function memory(overrides: Partial<CompanionMemory> = {}): CompanionMemory {
  return {
    id: 'memory-1', type: 'episodic', summary: 'They discussed her uncertainty about an old identity.',
    createdAt: yesterday.toISOString(), salience: 0.8, emotionalWeight: 0.7,
    sensitivity: 0.2, unresolved: false, people: [], topics: ['identity'], retrievalCount: 0,
    ...overrides,
  }
}

describe('living companion architecture', () => {
  it('treats a generic new-day greeting as a new chapter', () => {
    const state = createDefaultCharacterState('seraphine', yesterday)
    const engine = runCharacterEngine({
      companionSlug: 'seraphine', userText: 'Good morning.', affinity: 8, hour: 9,
      state, now: today,
      recentHistory: 'Mark: I am afraid of losing who I was.\nSeraphine: The old shape still lingers in the quiet.',
      memories: [memory()],
    })

    expect(engine.direction.newDayDetected).toBe(true)
    expect(engine.direction.callbackAllowed).toBe(false)
    expect(engine.direction.continuity).toBe('new_turn')
    expect(engine.relevantMemories).toEqual([])
    expect(engine.direction.prohibitedPatterns).toContain('callbacks to previous-day topics')
  })

  it('allows an explicit callback when Mark references last night', () => {
    const engine = runCharacterEngine({
      companionSlug: 'seraphine', userText: 'I have been thinking about what we talked about last night.',
      affinity: 8, hour: 9, state: createDefaultCharacterState('seraphine', yesterday), now: today,
      memories: [memory()],
    })
    expect(explicitlyRequestsCallback('I have been thinking about what we talked about last night.')).toBe(true)
    expect(engine.direction.callbackAllowed).toBe(true)
    expect(engine.direction.callbackReason).toMatch(/explicitly/)
    expect(engine.relevantMemories).toHaveLength(1)
  })

  it('preserves a genuine open loop across a greeting', () => {
    const openLoop = memory({
      type: 'open_loop', summary: 'Mark promised to explain what happened tomorrow.',
      unresolved: true, sensitivity: 0.1,
    })
    const engine = runCharacterEngine({
      companionSlug: 'seraphine', userText: 'Good morning.', affinity: 8, hour: 9,
      state: createDefaultCharacterState('seraphine', yesterday), now: today, memories: [openLoop],
    })
    expect(engine.direction.callbackAllowed).toBe(true)
    expect(engine.direction.topicSource).toBe('open_loop')
    expect(engine.relevantMemories[0]?.id).toBe(openLoop.id)
  })

  it('carries a persisted scene obligation across the day boundary', () => {
    const state = createDefaultCharacterState('seraphine', yesterday)
    state.scene.unresolvedObligations = ['Mark said he would explain the client decision tomorrow.']
    const engine = runCharacterEngine({
      companionSlug: 'seraphine', userText: 'Good morning.', affinity: 8, hour: 9,
      state, now: today,
    })
    expect(engine.direction.callbackAllowed).toBe(true)
    expect(engine.direction.topicSource).toBe('open_loop')
    expect(engine.relevantMemories[0]?.summary).toContain('client decision')
  })

  it('suppresses sensitive memories for a generic greeting', () => {
    const selected = retrieveRelevantMemories({
      userText: 'Good morning.', now: today, newDayDetected: true,
      memories: [memory({ type: 'sensitive', sensitivity: 0.95, summary: 'Private childhood trauma.', unresolved: false })],
    })
    expect(selected).toEqual([])
  })

  it('retrieves a directly relevant factual preference without relying on recency', () => {
    const selected = retrieveRelevantMemories({
      userText: 'Which music should I practice on piano today?', now: today, newDayDetected: false,
      memories: [memory({ type: 'factual', summary: 'Mark prefers practicing jazz piano in the morning.', topics: ['piano', 'jazz'], createdAt: '2025-01-01T00:00:00.000Z' })],
    })
    expect(selected).toHaveLength(1)
  })

  it('initializes a stable daily state instead of rerolling each call', () => {
    const first = initializeDailyState({ companionSlug: 'seraphine', now: today })
    const second = initializeDailyState({ companionSlug: 'seraphine', now: today, previous: first })
    expect(second).toBe(first)
  })

  it('closes an ordinary prior scene but pauses one with obligations', () => {
    const ordinary = createDefaultCharacterState('seraphine', yesterday)
    ordinary.scene.topicIds = ['identity']
    const archived = rollDailyBoundary(ordinary, today).state
    expect(archived.scene.status).toBe('archived')
    expect(archived.daily.priorDayTopicCooldowns).toContain('identity')
    expect(archived.reflections.at(-1)?.topicsToAvoidAutoContinuing).toContain('identity')

    const open = createDefaultCharacterState('seraphine', yesterday)
    open.scene.unresolvedObligations = ['Mark will explain what happened.']
    expect(rollDailyBoundary(open, today).state.scene.status).toBe('paused')
  })

  it('handles Chicago local dates across the daylight-saving jump', () => {
    expect(localDateFor(new Date('2026-03-08T07:30:00.000Z'))).toBe('2026-03-08')
    expect(localDateFor(new Date('2026-03-08T08:30:00.000Z'))).toBe('2026-03-08')
    expect(localDateFor(new Date('2026-03-09T04:30:00.000Z'))).toBe('2026-03-08')
    expect(localDateFor(new Date('2026-03-09T05:30:00.000Z'))).toBe('2026-03-09')
  })

  it('keeps inner-life initiative concrete and lets urgent user need override it', () => {
    const state = createDefaultCharacterState('seraphine', today)
    state.daily.socialEnergy = 80
    expect(selectInnerLifeInitiative(state, 'Good morning.')).toMatch(/herbs|book|language/)
    expect(selectInnerLifeInitiative(state, 'This is urgent. Help me now.')).toBeUndefined()
  })

  it('rejects vague poetic morning language and unauthorized continuation', () => {
    const engine = runCharacterEngine({
      companionSlug: 'seraphine', userText: 'Good morning.', affinity: 8, hour: 9,
      state: createDefaultCharacterState('seraphine', yesterday), now: today,
    })
    const vague = evaluateCompanionReply({ reply: 'The morning feels quieter today.', direction: engine.direction })
    const callback = evaluateCompanionReply({ reply: 'Morning. I am still carrying what we discussed last night.', direction: engine.direction })
    expect(vague.violations).toContain('vague_language')
    expect(callback.violations).toContain('new_day_continuation')
  })

  it('accepts recognizable concrete Seraphine voice without poetic keywords', () => {
    const engine = runCharacterEngine({
      companionSlug: 'seraphine', userText: 'Good morning.', affinity: 8, hour: 9,
      state: createDefaultCharacterState('seraphine', yesterday), now: today,
    })
    const reply = 'Morning. I may have killed the basil, which feels like an unreasonable amount of authority for one plant to give me.'
    const result = evaluateCompanionReply({ reply, direction: engine.direction })
    expect(result.passed).toBe(true)
    expect(reply).not.toMatch(/quiet|light|stillness|shadow|warmth|flame/i)
    expect(coreIdentityFor('seraphine').humorStyle).toContain('dry understatement')
  })

  it('keeps high trust behavioral instead of forcing affection or vulnerability', () => {
    const state = createDefaultCharacterState('seraphine', today)
    state.relationship.trust = 90
    state.relationship.emotionalSafety = 90
    const engine = runCharacterEngine({ companionSlug: 'seraphine', userText: 'The meeting went fine.', affinity: 14, hour: 16, state, now: today })
    expect(engine.direction.primaryMove).toBe('acknowledge')
    expect(engine.direction.objectives).not.toContain('flirt')
  })

  it('supports healthy disagreement as a stable identity behavior', () => {
    const identity = coreIdentityFor('seraphine')
    expect(identity.temperament.flatMap((trait) => trait.behavioralExpressions).join(' ')).toMatch(/challenge Mark respectfully/)
    expect(identity.boundaries).toContain('may disagree')
  })

  it('adapts legacy memory strings conservatively', () => {
    expect(legacyMemory('Mark prefers jazz piano.', 0).type).toBe('factual')
    expect(legacyMemory('Remind Mark tomorrow to tell the story.', 1).type).toBe('open_loop')
    expect(legacyMemory('Private childhood trauma.', 2).type).toBe('sensitive')
    expect(legacyMemory('He is practicing speaking more directly.', 3).type).toBe('growth')
    expect(legacyMemory('He feels safe in our relationship.', 4).type).toBe('relational')
  })

  it('upgrades a legacy character state without losing established relationship data', () => {
    const upgraded = hydrateCharacterState({
      companionSlug: 'seraphine', now: today,
      row: {
        companion_slug: 'seraphine', updated_at: yesterday.toISOString(),
        state: {
          version: 1, companionSlug: 'seraphine', energy: 60, stress: 30,
          relationship: { trust: 81, conflict: 9 },
          currentGoals: [{ id: 'goal-1', label: 'Finish the book', progress: 0.6, status: 'active' }],
          recentEvents: ['Mark finished a difficult meeting.'], updatedAt: yesterday.toISOString(),
        },
      },
    })
    expect(upgraded.version).toBe(2)
    expect(upgraded.relationship.trust).toBe(81)
    expect(upgraded.relationship.conflict).toBeGreaterThan(0)
    expect(upgraded.relationship.conflict).toBeLessThanOrEqual(9)
    expect(upgraded.relationship.emotionalSafety).toBeTypeOf('number')
    expect(upgraded.currentGoals[0]?.label).toBe('Finish the book')
    expect(upgraded.daily.localDate).toBe(localDateFor(today))
  })

  it('repairs a partial version-2 state instead of accepting an unsafe shape', () => {
    const repaired = hydrateCharacterState({
      companionSlug: 'seraphine', now: today,
      row: {
        companion_slug: 'seraphine', updated_at: today.toISOString(),
        state: {
          version: 2, companionSlug: 'seraphine', energy: 55, stress: 25,
          relationship: { trust: 74 }, currentGoals: [], updatedAt: today.toISOString(),
        },
      },
    })
    expect(repaired.version).toBe(2)
    expect(repaired.relationship.trust).toBe(74)
    expect(repaired.daily.localDate).toBe(localDateFor(today))
    expect(repaired.scene.status).toBe('active')
  })

  it('evaluation harness flags motif fatigue and scores concrete freshness', () => {
    const engine = runCharacterEngine({
      companionSlug: 'seraphine', userText: 'Good morning.', affinity: 8, hour: 9,
      state: createDefaultCharacterState('seraphine', yesterday), now: today,
    })
    const tired = evaluateBehaviorFixture({
      reply: 'Morning. The light feels softer today.', direction: engine.direction,
      recentReplies: ['The light is starting to feel like it belongs again.', 'There is warmth in the light.'],
    })
    const fresh = evaluateBehaviorFixture({
      reply: 'Morning. I finished that book, and the ending irritated me.', direction: engine.direction,
      recentReplies: ['The light is starting to feel like it belongs again.'],
    })
    expect(tired.passed).toBe(false)
    expect(tired.scores.topicNovelty).toBeLessThan(fresh.scores.topicNovelty)
    expect(fresh.scores.newDayFreshness).toBeGreaterThan(0.9)
  })
})
