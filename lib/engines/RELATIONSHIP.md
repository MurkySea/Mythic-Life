# Dual-Axis Relationship System

Added 2026-07-24.

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

When a companion reaches out because the rhythm has been off:

| Choice | Effect |
|--------|--------|
| `honest` | Strongest growth in both Trust and Intimacy |
| `ask_support` | Solid growth in both |
| `push_through` | Small Trust gain, slight Intimacy loss |
| `deflect` | Damage to both (less severe if she already loves you) |

Honesty is the primary long-term driver of Intimacy.

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

Wire points still needed:
- Persist Trust + Intimacy per companion (alongside or replacing pure affinity_score)
- Surface response choices in the message / outreach UI
- Feed Rhythm tier into `updateTrustWithPatience`
- Call interaction effects from chat / check-in flows
