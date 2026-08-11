# Behavioral foundations

Mythic Life converts real-world action into momentum, discovery, relationships, and meaningful completion. The behavioral order is:

`autonomy → novelty → immediate reward → meaning → relationships → completion → momentum`

## Architecture

The existing `tasks` table remains the canonical action ledger. Recurring tasks are backfilled as `ritual`; finite tasks are backfilled as `quest`. This avoids a second task hierarchy and preserves every production row.

- `lib/behavior/rituals.ts` models ordered chains and optional flexible windows.
- `lib/behavior/momentum.ts` owns tunable, shame-free momentum transitions.
- `lib/behavior/rewards.ts` owns progress and completion reward calculation.
- `lib/behavior/events.ts` owns deterministic eligibility, cooldowns, repetition prevention, and weighted selection. AI is not called here.
- `lib/behavior/pipeline.ts` is the pure completion boundary.
- `lib/behavior/completion-service.ts` persists idempotent receipts, momentum, and eligible world events.
- `lib/behavior/adventure.ts` selects three responsible choices while preserving autonomy.
- `lib/behavior/signals.ts` derives evidence-backed observations for companions without diagnosing the user.

Existing skills, standing, loot, companion relationships, goals, and character-engine behavior remain adapters/consumers. They are not duplicated under new names.

## Tunable formulas

All current values live in exported configuration objects. Momentum gains 12 per completion, has one grace day, decays softly by 4 per extra missed day, and awards an 8-point quick-return bonus. World events have a 28% base eligibility chance, an eight-hour global cooldown, and a 72-hour repetition window. Quest completion begins at 36 XP versus 8 XP for incremental progress, with a capped effort bonus.

These are initial product defaults, not immutable psychology claims.

## Data and security

The migration adds compatible task columns plus owner-scoped domains, ritual chains, momentum, profiles, signals, receipts, and world events. Every new table has RLS and authenticated-owner policies. `action_receipts` has a unique completion key so retries cannot award the same source action twice.

## Intentionally deferred

- Domain decay and punitive neglected-state transitions.
- AI-authored encounters; deterministic events must prove useful first.
- Full ritual-chain editing UI and quest milestone authoring.
- Automatic motivational-profile inference or exposed personality scores.
- Per-domain and per-ritual momentum UI (the schema and engine support those scopes).
- Rich world-event scenes, merchants, miniquests, and location unlocks.

The next phase should connect persisted world events to a small discovery inbox, add ritual-chain authoring, and replace remaining legacy reward adapters one at a time with the unified completion receipt.
