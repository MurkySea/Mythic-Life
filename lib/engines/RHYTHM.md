# Rhythm Engine & Health Data Sync

Added / updated 2026-07-25.

## Policy

| Setting | Value |
|---------|-------|
| Sync cadence | Every **12 hours** |
| Query model | Incremental **“from last sync”** |
| Bootstrap window | Last **7 days** (first run or missing cursor) |
| Safety cap | Never look back more than **30 days** in one query |
| Cursor advance | Only after successful write + engine processing |
| Night finalization | Provisional until clean wake **or** hard cutoff (14:00 local) |

## Why this shape

- Battery and privacy friendly.
- Incremental pulls keep payloads small and idempotent (upsert by sample ID).
- Provisional nights prevent companions from reacting to incomplete sleep data while the user is still asleep.
- Force-finalize at 14:00 local keeps the daily Rhythm Score and Consistency Tokens on a predictable schedule.

## Integration path

1. Background scheduler (or hybrid app bridge) calls `planSync(state)`.
2. If `shouldRun`, perform the real HealthKit / export query using the returned window.
3. Upsert samples by ID.
4. Call `processNewSamples(...)` → get `RhythmDay[]`.
5. Only then call `advanceSuccessfulSync`.
6. On failure call `recordFailedAttempt` and respect `backoffMinutes`.

Companions, Consistency Tokens, and the Truth Multiplier should only react to **finalized** nights.

## Key pure functions (`lib/engines/health-sync.ts`)

- `computeQueryWindow(state, now?)`
- `shouldRunSync(state, now?)`
- `planSync(state, now?)`
- `advanceSuccessfulSync(prev, at?)`
- `recordFailedAttempt(prev, at?)`
- `backoffMinutes(failures)`
- `evaluateNightStatus(samples, date, now)`
- `processNewSamples(samples, now, getLocalDate)`

## Config defaults

```ts
{
  hardCutoffHour: 14,
  bootstrapDays: 7,
  syncIntervalHours: 12
}
```

All values live in `DEFAULT_RHYTHM_CONFIG` and can be overridden per environment.
