# Vacation / Recovery / Ramp Mode

Finalized 2026-07-25.

## Purpose

Protect long-term sustainability of the Mythic Life system.  
High-conscientiousness users will eventually turn any tracker against themselves.  
Vacation Mode makes intentional rest a first-class, system-supported state rather than an exception that must be justified.

## Modes

| Mode       | Trigger                        | Protections                                      | Specials                          |
|------------|--------------------------------|--------------------------------------------------|-----------------------------------|
| `normal`   | Default                        | Full scoring                                     | —                                 |
| `vacation` | Manual (or calendar)           | Rhythm freeze, Debt freeze + decay, Trust protected + drift | Qualifies for Rested Buff        |
| `recovery` | Sick day / forced rest         | Same protections as vacation                     | Does **not** qualify for full Buff |
| `ramp`     | Automatic on exit from rest    | Soft debt accrual (×0.4), grace language         | Temporary re-entry window         |

## Core Policy

| Setting                        | Value      |
|--------------------------------|------------|
| Shadow Debt decay per rest day | **7 %**    |
| Min consecutive vacation days for full Rested Buff | **4** |
| Ramp window length             | **3 days** |
| Rested Buff duration           | **6 days** |
| Trust positive drift per rest day | **+1.5** |
| Token multiplier while Rested Buff active | **×1.25** |

## Effect Matrix

| System                  | Rest Mode (`vacation` / `recovery`)          | Ramp Mode          |
|-------------------------|----------------------------------------------|--------------------|
| Rhythm scoring          | Frozen                                       | Normal             |
| Shadow Debt accrual     | Blocked + gradual decay                      | ×0.4               |
| Companion Trust (sleep) | Protected (no penalties) + slow positive drift | Normal           |
| Consistency Tokens      | Still earnable via Vacation Quests           | Normal + Buff if active |
| Reality Audit pressure  | Reduced / self-report only                   | Softening          |

## Lifecycle

```
enterVacation() or enterRecovery()
        ↓
advanceDay() each calendar day
  → debt decays, trust drifts, consecutiveRestDays++
        ↓
exitRestMode()
  → enters Ramp
  → awards Rested Buff if vacation ≥ 4 days
        ↓
advanceDay() until Ramp endsAt reached
  → automatic return to normal
```

## Vacation Quests (light dopamine layer)

Default set (overridable):

1. **Shared Experience** – Capture one genuine shared moment with Lauren  
2. **Body Reset** – One deliberate restoring action  
3. **Pure Joy** – One action with zero productive justification  

Completing them awards tokens (multiplied by Rested Buff when active).  
Missing them does nothing.

## Integration Points

Other engines should consult the pure helpers in `lib/engines/vacation.ts`:

```ts
import {
  isRestMode,
  shouldFreezeRhythm,
  shouldAccrueShadowDebt,
  shouldApplySleepPenalty,
  shadowDebtMultiplier,
  tokenMultiplier,
  advanceDay,
  // …
} from './vacation'
```

### Recommended call sites

- **Rhythm / health-sync**: skip tier finalization or trust updates while `shouldFreezeRhythm(mode)`
- **Shadow Debt accrual**: multiply by `shadowDebtMultiplier(mode)` or skip entirely
- **Companion Trust (sleep events)**: guard with `shouldApplySleepPenalty(mode)`
- **Token awards**: multiply by `tokenMultiplier(modeState)`
- **Daily roll-up**: call `advanceDay()` once per calendar day

## Rested Buff

Only earned by exiting a **vacation** that lasted ≥ 4 consecutive days.  
Effects while active:

- +25 % Consistency Token multiplier
- Soft psychological “you earned this rest” framing for companions

Recovery mode receives the same protections but never the full Buff, preventing gaming via repeated short sick-day toggles.

## Edge Cases

- Weekend soft vacation → just call `enterVacation` for 1–2 days
- Unexpected extension → one-tap extend (update `endsAt`)
- Long absence (>14–21 days) → optional future Hibernation mode (not yet implemented)
- Data integrity → historical scores / debt / trust remain untouched; only clocks are frozen

## Files

- `lib/engines/vacation.ts` – pure types + transitions + query helpers
- This document
