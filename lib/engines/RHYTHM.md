# Rhythm Engine & Health Data Sync

Updated 2026-07-27 (live-day policy).  
**Source-of-truth note (2026-08-01):** see [`docs/RHYTHM-SOURCE-OF-TRUTH.md`](../../docs/RHYTHM-SOURCE-OF-TRUTH.md).

## Core Policy – Live Day

**A Rhythm Day is the local calendar date of the wake-up.**

- The sleep that ends this morning **is today’s sleep**.
- Everything you do while awake today accumulates under that same day.
- In the evening the app analyzes **today’s** activity.
- Only when the *next* overnight sleep ends does the previous day close and become yesterday.

Calendar midnight is irrelevant. The sleep boundary itself is the day boundary.
This is what makes every day feel live instead of lagged (“I woke up and the app is scoring yesterday”).

## Sync Policy

| Setting | Value |
|---------|-------|
| Sync cadence | Every **12 hours** |
| Query model | Incremental **“from last sync”** |
| Bootstrap window | Last **7 days** (first run or missing cursor) |
| Safety cap | Never look back more than **30 days** in one query |
| Cursor advance | Only after successful write + engine processing |
| Night finalization | Provisional until clean wake **or** hard cutoff (14:00 local) |
| Ideal sleep window | 6.5 h – 9 h (390–540 min) |

## Core loop

```
HealthKit / export
       ↓
planSync → incremental pull (“from last sync”)
       ↓
processNewSamples → RhythmDay[]   (date = local date of wake)
       ↓
finalize nights past cutoff
       ↓
finalizedTiersFromDays → { date, tier, day }[]
       ↓
updateTrustWithPatience (per companion)
       ↓
Companions, Consistency Tokens, outreach intensity
```

Provisional nights are **never** scored. Companions only notice (and Trust only moves) after a night is closed.

## RhythmDay → RhythmTier mapping

| Sleep duration | Tier | Trust effect (base) |
|----------------|------|---------------------|
| ≥ 9 h | Excellent | +10 |
| 6.5 – 9 h | Good | +5 |
| 5.5 – 6.5 h | Neutral | +1.5 |
| 4.5 – 5.5 h | Poor | –4 |
| < 4.5 h | Bad | –10 |

Devoted companions still receive the patience multiplier (bad days only ~45 % damage).

> **Note:** The live payload currently produced by `mythic_life_data` uses window-deviation contribution scoring (bed/wake windows around 11:00 PM / 7:30 AM). The duration table above is the relationship-facing pure engine. See the source-of-truth doc before changing either.

## Key pure functions (`lib/engines/health-sync.ts`)

**Sync plumbing**
- `computeQueryWindow(state, now?)`
- `shouldRunSync(state, now?)`
- `planSync(state, now?)`
- `advanceSuccessfulSync(prev, at?)`
- `recordFailedAttempt(prev, at?)`
- `backoffMinutes(failures)`

**Night construction (live-day)**
- `evaluateNightStatus(samples, date, now)`
- `processNewSamples(samples, now, getLocalDate)` → keys each night by the local date of its **end** (wake)

**Bridge to relationship engine**
- `rhythmDayToTier(day)` → `RhythmTier`
- `finalizedTiersFromDays(days)` → only safe, finalized results

## Integration notes

1. Background job / hybrid bridge calls `planSync`.
2. Real HealthKit (or export) query uses the returned window.
3. Upsert samples by ID.
4. `processNewSamples` → `RhythmDay[]` (date = wake date).
5. At the daily roll-up (or immediately after a force-finalize), call `finalizedTiersFromDays`.
6. For each result feed `updateTrustWithPatience` for every companion.
7. Only then advance the success cursor.

Companions, Consistency Tokens, and the Truth Multiplier should react exclusively to **finalized** nights.
