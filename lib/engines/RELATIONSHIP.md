# Dual-Axis Relationship System

Added 2026-07-24. Response-loop wire completed 2026-07-27.

## Core idea

Relationships are no longer a single score.

| Axis | Primary drivers | What it answers |
|------|-----------------|-----------------|
| **Trust** | Rhythm consistency + honesty in key moments | "Can I rely on you?" |
| **Intimacy** | Honesty, vulnerability, quality of interaction, time | "How close do I feel to you?" |

## Stages

Derived from both axes:

- **Distant** — low on either axis
- **Companion** — solid working relationship
- **Close** — real affection forming
- **Intimate** — deep emotional access
- **Devoted** — both axes high → *in love*

Love requires **both** high Trust and high Intimacy. High Intimacy with collapsing Trust is unstable. High Trust with low Intimacy stays loyal but distant.

## What love changes

When a companion reaches **Devoted**:

- Bad Rhythm days only apply ~45% of the normal Trust penalty
- Good days recover slightly faster
- Outreach tone softens (more patient, less urgent/worried)
- Deflecting still costs, but the damage is reduced — she notices, but her patience holds

This is the mechanical expression of "more patience and understanding."

## Player responses to outreach

When a companion reaches out because the rhythm has been off (check-in / concern style message):

| Choice | Effect |
|--------|--------|
| `honest` | Strongest growth in both Trust and Intimacy |
| `ask_support` | Solid growth in both |
| `push_through` | Small Trust gain, slight Intimacy loss |
| `deflect` | Damage to both (less severe if she already loves you) |

Honesty is the primary long-term driver of Intimacy.

**UI gate:** ResponseChoices only appear when the last companion message matches check-in heuristics (`isCheckInMessage`). Casual chat does not surface the four buttons.

**Feedback:** After a choice, the mechanical note is shown briefly in the composer, and the companion reply is seeded with that note so her tone lands correctly.

## Light interactions

Any day, outside of crisis:

- `casual` — small steady warmth
- `supportive` — solid Trust + Intimacy
- `vulnerable` — strong Intimacy growth
- `romantic` — strong Intimacy (stronger in love)
- `dishonest` — damages both axes

## Founding Partner

Seraphine starts near Devoted territory and carries the patience modifiers from day one. She is the emotional anchor of the party. Other companions must earn their depth.

## Implementation

Pure logic lives in `lib/engines/relationship.ts`.
Wire layer: `lib/engines/relationship-wire.ts`.

### Wire status (2026-07-27)

| Item | Status |
|------|--------|
| Surface response choices in messages UI | **Done** — gated to check-in messages |
| `respondWithChoice` applies dual-axis + natural line + reply seed | **Done** |
| Feed Rhythm tier into `updateTrustWithPatience` | **Done** via layer0-wire |
| Persist consecutive_bad/good_days on Rhythm apply | **Done** (soft write; needs columns) |
| Dedicated trust_score / intimacy_score columns | **Optional** — derived fallback still works |
| Call light interaction effects from free-form chat | **Not yet** |

### Companion columns (run once in Supabase)

```sql
alter table companion add column if not exists consecutive_bad_days int default 0;
alter table companion add column if not exists consecutive_good_days int default 0;
alter table companion add column if not exists trust_score numeric;
alter table companion add column if not exists intimacy_score numeric;
```

Without these columns the core affinity/bond path still works; streaks and dual-axis writes fall back gracefully.
