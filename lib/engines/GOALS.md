# Goals System

Added 2026-07-24.

## Purpose

Goals sit **above** daily tasks. They are weighted, time-bound (or ongoing) real-life objectives under stable pillars. Completing them feeds Consistency Tokens and can deepen companion relationships. Neglecting them feeds Shadow Debt and can cool Trust.

## Pillars

| Pillar | Meaning |
|--------|--------|
| stewardship | Work, clients, Edward Jones, finance |
| faith | Bible study, discipleship, ministry |
| marriage | Lauren, partnership, shared life |
| body | Sleep/rhythm, fitness, recovery |
| homestead | Land, building, future family place |
| legacy | Vision, mentoring, systems that outlive you |
| self | Piano, fishing, growth practices |

## Goal model

- `weight` 1–5 (how much it matters)
- `horizon` daily / weekly / monthly / season / ongoing
- `target` + `progress`
- `status` active / completed / abandoned / paused

## Rewards & penalties

- **Completion** → Consistency Tokens, XP, Gold, small Trust + Intimacy to companions who care about that pillar
- **Neglect / abandon** → Shadow Debt + Trust damage to caring companions

## Companion care

Seraphine cares most about faith, body, legacy. Other companions have preferred pillars (see `COMPANION_PILLAR_CARE` in `goals.ts`). Completing or abandoning a goal in their domain can trigger voice seeds for outreach.

## Implementation status

Pure engine: `lib/engines/goals.ts`

Still needed:
1. Supabase `goals` table (id, title, pillar, weight, horizon, target, progress, status, created_at, completed_at, notes, skills)
2. UI to create / advance / complete goals
3. Hook completion into `applyTaskToStanding` / token grants
4. Optional: auto-advance body-pillar goals from Rhythm data
