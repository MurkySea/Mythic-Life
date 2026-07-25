# Goals System

Added 2026-07-24. UI + store live 2026-07-25.

## Purpose

Goals sit **above** daily tasks. They are weighted, time-bound (or ongoing) real-life objectives under stable pillars. Completing them feeds Consistency Tokens and XP/Gold. Neglecting them feeds Shadow Debt.

## Routes

- `/goals` — active / paused / history
- `/goals/new` — create form
- Home Grimoire tile → Goals

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

- **Completion** → Consistency Tokens, XP, Gold (via `player_standing`)
- **Abandon** → Shadow Debt

## Supabase schema (run once)

```sql
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  pillar text not null,
  weight int not null default 3,
  horizon text not null default 'weekly',
  target int not null default 1,
  progress int not null default 0,
  status text not null default 'active',
  notes text,
  skills text,
  created_at timestamptz default now(),
  completed_at timestamptz,
  updated_at timestamptz default now()
);

create index if not exists goals_status_idx on goals (status);
create index if not exists goals_pillar_idx on goals (pillar);
```

## Files

- `lib/engines/goals.ts` — pure engine
- `lib/engines/goals-store.ts` — Supabase CRUD + standing hooks
- `app/goals/actions.ts` — server actions
- `app/goals/page.tsx` — list UI
- `app/goals/new/page.tsx` — create form

## Still optional

- Companion voice reaction on goal complete / abandon
- Auto-advance body-pillar goals from Rhythm data
- Link tasks → goal progress
