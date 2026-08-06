import { evaluateCompanionReply } from '@/lib/character-engine/quality'
import type { ConversationDirection } from '@/lib/character-engine/types'
import { SERAPHINE_MOTIFS } from '@/lib/character-engine/living'

export type CompanionBehaviorScores = {
  naturalness: number
  directness: number
  relevance: number
  callbackAppropriateness: number
  topicNovelty: number
  lexicalVariety: number
  identityConsistency: number
  emotionalProportionality: number
  initiativeQuality: number
  newDayFreshness: number
  memoryRestraint: number
  conversationalBrevity: number
}

export function evaluateBehaviorFixture(opts: {
  reply: string
  direction: ConversationDirection
  recentReplies?: string[]
}): { passed: boolean; flags: string[]; scores: CompanionBehaviorScores } {
  const quality = evaluateCompanionReply({ reply: opts.reply, direction: opts.direction })
  const words = opts.reply.trim().split(/\s+/).filter(Boolean)
  const recent = (opts.recentReplies ?? []).join(' ')
  const repeatedMotifs = Object.values(SERAPHINE_MOTIFS)
    .filter((pattern) => pattern.test(opts.reply) && pattern.test(recent)).length
  const callback = /\b(?:yesterday|last night|remember|you told me|old shape)\b/i.test(opts.reply)
  const concrete = /\b(?:book|herbs?|basil|song|meeting|sleep|paperwork|plan|today|morning)\b/i.test(opts.reply)
  const flags = [...quality.failures]
  if (repeatedMotifs > 0) flags.push('Reply repeats a recently saturated motif.')
  if (callback && !opts.direction.callbackAllowed) flags.push('Reply uses an unauthorized callback.')
  const bounded = (value: number) => Math.max(0, Math.min(1, value))
  const scores: CompanionBehaviorScores = {
    naturalness: bounded(1 - quality.failures.length * 0.18),
    directness: bounded(opts.reply.length > 0 ? 1 - Math.max(0, words.length - 90) / 120 : 0),
    relevance: quality.violations?.includes('director_mismatch') ? 0.2 : 0.9,
    callbackAppropriateness: callback === opts.direction.callbackAllowed ? 1 : callback ? 0 : 0.85,
    topicNovelty: bounded(1 - repeatedMotifs * 0.45),
    lexicalVariety: bounded(1 - repeatedMotifs * 0.35),
    identityConsistency: quality.violations?.includes('identity_mismatch') ? 0.2 : 0.9,
    emotionalProportionality: quality.violations?.includes('therapy_default') ? 0.2 : 0.9,
    initiativeQuality: opts.direction.topicSource === 'inner_life' ? (concrete ? 1 : 0.45) : 0.8,
    newDayFreshness: opts.direction.newDayDetected && callback && !opts.direction.callbackAllowed ? 0 : 0.95,
    memoryRestraint: callback && !opts.direction.callbackAllowed ? 0 : 1,
    conversationalBrevity: bounded(1 - Math.max(0, words.length - 45) / 80),
  }
  return { passed: flags.length === 0, flags: [...new Set(flags)], scores }
}
