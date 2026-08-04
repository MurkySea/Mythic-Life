# Rhythm Source of Truth

**Last updated:** 2026-08-01

## Current ownership

| Concern | Source of truth | Location |
|---------|-----------------|----------|
| Live sleep session selection | `mythic_life_data` | `app/api/health/route.ts` (`pickPrimarySleepSession`) |
| Live-day date (wake-date) | `mythic_life_data` | same file (`localDateFromIso`) |
| Live Rhythm tier + effects (contribution, multipliers, shadow debt, leader trust) | `mythic_life_data` | same file (`calculateRhythm` + `TIER_EFFECTS`) |
| Payload shape returned to Mythic-Life | `mythic_life_data` | `/api/latest` (in-memory store from last successful health POST) |
| Client contract for that payload | Mythic-Life | `lib/standing.ts` (`StandingResult`) |
| Pure relationship-facing engine, provisional nights, trust patience, Consistency Tokens | Mythic-Life | `lib/engines/health-sync.ts` + `lib/engines/RHYTHM.md` |

## Rules

1. **The live numbers the app displays and the multipliers it applies come from the data service.**  
   Mythic-Life fetches them via `fetchLatestStanding()` and must keep `StandingResult` in sync with the real `/api/latest` payload (ISO `bedtime` / `wakeTime`, display strings, signals, etc.).

2. **The pure engine in Mythic-Life is the relationship layer.**  
   It owns how finalized tiers affect companion trust, Consistency Tokens, outreach intensity, and Shadow Debt over time. It is allowed to be more sophisticated than the live calculator; it is not yet the source of the numbers shown on the Standing page.

3. **Do not silently diverge the two calculators.**  
   If you change tier thresholds, windows, or effects in one place, either update the other or document the intentional difference here.

4. **Live-day policy is shared and locked.**  
   A Rhythm Day is the local calendar date of the wake-up (America/Chicago). Morning re-sleeps are not bedtime. Prefer the most recent true overnight session by end time / wake-day.

## Why two places exist

- `mythic_life_data` is a small, private service that receives Health Auto Export payloads and must stay reliable and low-latency.
- Mythic-Life owns the long-term pure logic, companion reactions, and future HealthKit-native path.

Until the pure engine is promoted to own the live calculation (and the data service becomes a thin store + forwarder), treat the data service as the source of truth for every number the UI and reward systems currently consume.

## Checklist when changing Rhythm

- [ ] Does this change the payload shape? Update `StandingResult` in the same PR.
- [ ] Does this change tier effects or windows? Update or explicitly document the dual-repo difference.
- [ ] Does this change live-day or session selection? Prefer changing the data service first, then mirror the policy here.
