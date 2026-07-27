import { runLayer0Evaluation } from '@/lib/engines/layer0-wire'

/**
 * Called after a task is marked complete.
 * Now routes through Layer 0 so debt, tokens, multipliers, and dual-track
 * rewards come from the polished pure core.
 */
export async function runStandingForCompletedTask(opts: {
  title: string
  domains: string[]
}) {
  try {
    await runLayer0Evaluation({
      extraDomains: opts.domains,
      extraTitles: [opts.title],
    })
  } catch (e) {
    console.error('runStandingForCompletedTask failed', e)
  }
}
