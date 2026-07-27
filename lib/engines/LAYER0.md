# Mythic Life — Layer 0 (Foundation)

**Status: Complete 2026-07-26**

Layer 0 is the only layer that later systems are allowed to read for core scoring.
It is pure at the core (`layer0.ts`) with a thin live bridge (`layer0-wire.ts`).

## What belongs in Layer 0

| Concept | Responsibility |
|---------|----------------|
| **Rhythm** | Sleep-derived tier. Only *finalized* nights affect scoring. |
| **Weighted Task Ontology** | Domain scoring + Self-Neglect detection. |
| **Shadow Debt** | Accumulates on failure / self-neglect / severe rhythm. Burns via recovery. |
| **Consistency Tokens** | Gated currency. Requires task performance *and* acceptable Rhythm. |
| **Truth Multiplier** | External audit factor. Default 1.0. Raised only by verified data. |
| **Leader Trust (basic)** | Rhythm → Trust deltas applied to active party with patience. |
| **Multiplier Stack** | Final combined factor applied to rewards. |

## Hard invariants

1. Provisional Rhythm nights never move Trust, Tokens, or Debt.
2. Consistency Tokens cannot be earned by task spam alone — Rhythm must clear the gate.
3. Truth Multiplier is never pure self-report. It only rises with external verification.
4. Shadow Debt has a floor on the multiplier (never drives rewards to zero).
5. Rhythm → Debt and Rhythm → Trust run **at most once per rhythm date** (idempotent).
6. Per-task rewards are **incremental** (this task only). Full-day re-scoring is not used on every complete.
7. All pure functions in `layer0.ts` have no I/O. Side effects live only in `layer0-wire.ts`.

## Files

| File | Role |
|------|------|
| `lib/engines/layer0.ts` | Pure types + calculators + `evaluateDay` |
| `lib/engines/layer0-wire.ts` | Load → evaluate → persist; Trust wire to party |
| `lib/engines/health-sync.ts` | Rhythm day construction (consumed) |
| `lib/engines/ontology.ts` | Domains + Self-Neglect (consumed) |
| `lib/engines/relationship.ts` + `relationship-wire.ts` | Trust/Intimacy + `applyRhythmToCompanion` |

## Live path

```
Task completed
    → runStandingForCompletedTask
        → runLayer0Evaluation
            → applyDailyRhythmIfNeeded (once per rhythm date)
                → debt from severe tier
                → applyRhythmToCompanion for each active party member
            → buildMultiplierStack (Layer 0 pure)
            → incremental XP / Gold / Tokens for *this* task
            → saveStanding
```

## Consumption rule for later layers

- Layer 1+ may *read* Layer 0 results.
- Layer 1+ may *never* re-implement scoring logic.
- Narrative, party doctrine flavor, World Integrity display, and status screens are Layer 1+.

## Entry points

```ts
import { runLayer0Evaluation, runLayer0DailyClose } from '@/lib/engines/layer0-wire'
import { evaluateDay, buildMultiplierStack, ... } from '@/lib/engines/layer0'
```

`runLayer0Evaluation` is the production path after task completion.
`runLayer0DailyClose` is available for an explicit end-of-day / cron close.
