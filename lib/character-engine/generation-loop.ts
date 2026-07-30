import type { ConversationDirection } from '@/lib/character-engine/types'
import {
  evaluateCompanionReply,
  type ReplyQualityResult,
} from '@/lib/character-engine/quality'

export type CompanionDraftContext = {
  attempt: number
  direction: ConversationDirection
  previousDraft?: string
  quality?: ReplyQualityResult
}

export type CompanionGenerationResult = {
  reply: string
  attempts: number
  quality: ReplyQualityResult
}

/**
 * Generates, evaluates, and—when necessary—rewrites a companion reply.
 *
 * The caller owns the model/API request. This function owns the corrective loop,
 * so a failed quality check can no longer be treated as a suggestion inside a prompt.
 */
export async function generateCompanionWithQualityLoop(opts: {
  direction: ConversationDirection
  generate: (context: CompanionDraftContext) => Promise<string>
  maxAttempts?: number
}): Promise<CompanionGenerationResult> {
  const maxAttempts = Math.max(1, Math.min(opts.maxAttempts ?? 3, 4))
  let previousDraft: string | undefined
  let previousQuality: ReplyQualityResult | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const reply = String(
      await opts.generate({
        attempt,
        direction: opts.direction,
        previousDraft,
        quality: previousQuality,
      })
    ).trim()

    const quality = evaluateCompanionReply({
      reply,
      direction: opts.direction,
    })

    if (quality.passed) {
      return { reply, attempts: attempt, quality }
    }

    previousDraft = reply
    previousQuality = quality
  }

  const fallback = buildGroundedFallback(opts.direction)
  const fallbackQuality = evaluateCompanionReply({
    reply: fallback,
    direction: opts.direction,
  })

  return {
    reply: fallback,
    attempts: maxAttempts,
    quality: fallbackQuality,
  }
}

/** Creates the rewrite instruction for the next API call. */
export function buildCompanionRewritePrompt(context: CompanionDraftContext): string {
  if (!context.previousDraft || !context.quality) return ''

  return `The previous draft failed the relationship quality gate.

PREVIOUS DRAFT:
${context.previousDraft}

FAILURES:
${context.quality.failures.map((failure) => `- ${failure}`).join('\n')}

Rewrite the message as the same companion. Do not defend or discuss the draft. Add one specific relational move—accurate reflection, grounded curiosity, a meaningful choice, or character-specific presence. Avoid merely paraphrasing Mark or repeating decorative setting imagery. Output only the revised companion message.`
}

function buildGroundedFallback(direction: ConversationDirection): string {
  const topic = direction.topic.toLowerCase()

  if (topic.includes('exhaustion') || topic.includes('sleep')) {
    return "Your body sounds finished, but your mind clearly isn't. Is something specific keeping it moving, or are you stuck in that wired-tired place?"
  }

  if (direction.disclosure.depth >= 4) {
    return "I don't want to skim past what you just trusted me with. You don't have to explain more right now, but I am staying with you in it."
  }

  if (direction.contract?.active && direction.contract.nextActor === 'companion') {
    return 'I heard your answer. What part of that matters most to you?'
  }

  return 'I heard what you said, and I do not want to answer with something empty. What part of this feels most important right now?'
}
