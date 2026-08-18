import type { CompanionDef } from '@/lib/companions'
import { visualCanonPrompt } from './characterSheets'
import {
  fulfillExplicitCompanionImageRequest as baseFulfillExplicitCompanionImageRequest,
  isCompanionImageRequest,
  maybeGenerateCompanionImageGift as baseMaybeGenerateCompanionImageGift,
  normalizeCompanionImagePrompt,
  parseCompanionImageIntent,
  MAX_COMPANION_IMAGE_PROMPT_CHARS,
  type CompanionImageGiftResult,
  type CompanionImageIntent,
  type ExplicitCompanionImageResult,
} from './companion-image-gifts'

function withVisualCanon(def: CompanionDef | null | undefined): CompanionDef | null | undefined {
  if (!def) return def
  const visualCanon = visualCanonPrompt(def)
  if (!visualCanon) return def
  return {
    ...def,
    appearance: visualCanon,
  }
}

export async function fulfillExplicitCompanionImageRequest(
  args: Parameters<typeof baseFulfillExplicitCompanionImageRequest>[0]
): Promise<ExplicitCompanionImageResult> {
  return baseFulfillExplicitCompanionImageRequest({
    ...args,
    def: withVisualCanon(args.def),
  })
}

export async function maybeGenerateCompanionImageGift(
  args: Parameters<typeof baseMaybeGenerateCompanionImageGift>[0]
): Promise<CompanionImageGiftResult> {
  return baseMaybeGenerateCompanionImageGift({
    ...args,
    def: withVisualCanon(args.def),
  })
}

export {
  isCompanionImageRequest,
  normalizeCompanionImagePrompt,
  parseCompanionImageIntent,
  MAX_COMPANION_IMAGE_PROMPT_CHARS,
}
export type {
  CompanionImageGiftResult,
  CompanionImageIntent,
  ExplicitCompanionImageResult,
}
