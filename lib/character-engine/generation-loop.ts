import type { ConversationDirection } from '@/lib/character-engine/types'
import { evaluateCompanionReply } from '@/lib/character-engine/quality'

function sanitizeDraft(message: string, displayName: string): string {
  return String(message || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(new RegExp(`^${displayName}\s*:\s*`, 'i'), '')
    .replace(/^\*[^*]+\*\s*/g, '')
    .trim()
}

export function buildCompanionRewritePrompt(opts: {
  displayName: string
  previousDraft: string
  failures: string[]
}) {
  const { displayName, previousDraft, failures } = opts
  return `Rewrite ${displayName}'s message. The previous draft is below.

Previous draft:
"""
${previousDraft}
"""

The draft failed these checks:
${failures.map((f) => `- ${f}`).join('\n')}

Rewrite once. Keep the same character voice and length, but fix the listed failures. Output only the final companion message.`
}

export async function generateCompanionWithQualityLoop(opts: {
  systemPrompt: string
  userPrompt: string
  displayName: string
  companionSlug: string
  direction: ConversationDirection
  maxAttempts?: number
  maxTokens: number
  temperature: number
  generate: (system: string, user: string, options: { maxTokens: number; temperature: number }) => Promise<string>
}): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    displayName,
    direction,
    maxAttempts = 3,
    maxTokens,
    temperature,
    generate,
  } = opts

  let attempt = 0
  let lastDraft = ''

  try {
    let currentUser = userPrompt
    while (attempt < maxAttempts) {
      attempt += 1
      const raw = await generate(systemPrompt, currentUser, { maxTokens, temperature })
      const draft = sanitizeDraft(raw || '', displayName)
      lastDraft = draft

      const result = evaluateCompanionReply({ reply: draft, direction })
      if (result.passed) return draft

      if (attempt >= maxAttempts) break

      currentUser = buildCompanionRewritePrompt({
        displayName,
        previousDraft: draft,
        failures: result.failures,
      })
    }

    return ''
  } catch (e) {
    throw e
  }
}

export default generateCompanionWithQualityLoop
