# Mythic Life — Layer 0 (Foundation)

**Status: Polished 2026-07-26**

Layer 0 is the only layer that later systems are allowed to read for core scoring.
It is pure. No database, no UI, no narrative, no party doctrine.

## What belongs in Layer 0

| Concept | Responsibility |
|---------|----------------|
| **Rhythm** | Sleep-derived tier (Excellent → Bad). Only *finalized* nights affect anything. |
| **Weighted Task Ontology** | Domain scoring + Self-Neglect detection. |
| **Shadow Debt** | Accumulates on failure / self-neglect / severe rhythm. Burns via specific recovery. |
| **Consistency Tokens** | Gated currency. Requires both real task performance *and* acceptable Rhythm. |
| **Truth Multiplier** | External audit factor. Default 1.0. Raised only by verified data. |
| **Leader Trust (basic)** | Per-companion number driven primarily by Rhythm + honesty. |
| **Multiplier Stack** | Final combined factor applied to rewards. |

## Hard invariants

1. Provisional Rhythm nights never move Trust, Tokens, or Debt.
2. Consistency Tokens cannot be earned by task spam alone — Rhythm must clear the gate.
3. Truth Multiplier is never self-reported. It only rises with external verification.
4. Shadow Debt has a floor on the multiplier (never drives rewards to zero).
5. All functions in `layer0.ts` are pure. Side effects live outside.

## Consumption rule for later layers

- Layer 1+ may *read* Layer 0 results.
- Layer 1+ may *never* re-implement scoring logic.
- Narrative, party reactions, World Integrity, and status screens are Layer 1+.

## Entry point

```ts
import {
  evaluateDay,
  accumulateShadowDebt,
  burnShadowDebt,
  earnConsistencyTokens,
  applyTruthMultiplier,
  buildMultiplierStack,
  rhythmTrustDelta,
} from '@/lib/engines/layer0'
```

`evaluateDay` is the single daily roll-up that later systems should call.
