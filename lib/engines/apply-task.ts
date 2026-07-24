import { createClient } from '@/utils/supabase/server'
import { fetchLatestStanding } from '@/lib/standing'
import { applyTaskToStanding } from '@/lib/engines/standing-store'
import { aggregateDomains, detectSelfNeglect } from '@/lib/engines/ontology'
import { parseDomains } from '@/lib/skills'

/** Called after a task is marked complete. Safe to call from any server action. */
export async function runStandingForCompletedTask(opts: {
  title: string
  domains: string[]
}) {
  try {
    const supabase = await createClient()
    const health = await fetchLatestStanding()
    const rhythm = health?.rhythm

    const since = new Date()
    since.setDate(since.getDate() - 3)
    const { data: recent } = await supabase
      .from('tasks')
      .select('title, domains, domain, is_completed, completed_at')
      .eq('is_completed', true)
      .gte('completed_at', since.toISOString())
      .limit(80)

    const tags: string[] = [...opts.domains]
    const titles: string[] = [opts.title]
    for (const t of recent || []) {
      tags.push(...parseDomains(t.domains, t.domain))
      if (t.title) titles.push(t.title)
    }

    const aggregates = aggregateDomains(tags, { titles })
    const neglect = detectSelfNeglect(aggregates)

    await applyTaskToStanding({
      domainCount: Math.max(1, opts.domains.length),
      rhythmRewardEfficiency: rhythm?.rewardEfficiency ?? 1,
      rhythmTokenMultiplier: rhythm?.consistencyTokenMultiplier ?? 0.5,
      rhythmDebtDelta: rhythm?.shadowDebtDelta ?? 0,
      rhythmDate: health?.date ?? null,
      selfMultiplier: neglect.selfMultiplier,
      selfNeglectSeverity: neglect.severity,
      rhythmTier: rhythm?.tier ?? null,
    })
  } catch (e) {
    console.error('runStandingForCompletedTask failed', e)
  }
}
