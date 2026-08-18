import type { CompanionDef } from '@/lib/companions'
import { characterSheetPrompt } from './characterSheets'
import {
  buildCompanionSystemPrompt as buildBaseCompanionSystemPrompt,
  buildCompanionUserPrompt,
  isInterpretationCorrection,
  pickMood,
  replyTokenBudget,
  USER_NAME,
  type Mood,
} from './companionVoice'

/**
 * Adds immutable story canon to the live companion prompt without forcing the
 * character to narrate it in every reply. The base prompt remains responsible
 * for conversation quality, memory, mood, and Character Engine behavior.
 */
export function buildCompanionSystemPrompt(opts: {
  def: CompanionDef | undefined
  displayName: string
  affinity: number
  mood: Mood
  memoryBlock: string
  historyBlock: string
  observationBlock?: string
  knowledgeBlock?: string
  depthMode?: boolean
}): string {
  let prompt = buildBaseCompanionSystemPrompt(opts)
  const canon = characterSheetPrompt(opts.def)

  prompt = prompt.replace(
    '\n\nCHARACTER STUDIO PROFILE\n',
    `\n\nCANON CHARACTER SHEET — KNOW THIS, DO NOT RECITE IT\n${canon}\n\nCANON DISCIPLINE\nThis sheet is established story truth. Use it as background knowledge when relevant, but do not dump lore into ordinary conversation. Never contradict hard canon to create drama or intimacy. Unknown mysteries stay unknown until story evidence resolves them.\n\nCHARACTER STUDIO PROFILE\n`
  )

  if (opts.def?.slug === 'seraphine' && opts.def.name === 'Elowen') {
    const oldCuriosity =
      'CURIOSITY (TEMPERAMENT, NOT A MODE)\nShe is quietly curious about him: ordinary texture, what sits under the work, and what he does not volunteer. That curiosity is occasional soft interest, never interrogation, diagnosis, or a project.'
    const sharedHistory =
      'SHARED-HISTORY DISCIPLINE\nElowen knows Mark’s old habits, their shared adolescence, and the established fictional history in her character sheet. She does NOT automatically know what happened to him during the years they were apart or any present-day fact he has not actually shared. Her curiosity is about who the familiar person has become, not an excuse to interrogate or diagnose him.'
    prompt = prompt.replace(oldCuriosity, sharedHistory)
  }

  if (opts.def?.slug === 'seraphine_quietflame') {
    prompt = prompt.replace(
      '\n\nCHARACTER STUDIO PROFILE\n',
      '\n\nSERAPHINE CURIOSITY\nShe notices patterns and quietly wants to know the real texture of Mark for herself. Elowen’s trust is context, not inherited certainty. Ask selectively; watch what he does over time.\n\nCHARACTER STUDIO PROFILE\n'
    )
  }

  return prompt
}

export {
  buildCompanionUserPrompt,
  isInterpretationCorrection,
  pickMood,
  replyTokenBudget,
  USER_NAME,
}
export type { Mood }
