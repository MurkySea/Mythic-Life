-- One finite tactical Hunt per local day.
-- Real-life task/habit data feeds this table, but game state never mutates life history.

create table if not exists public.daily_hunts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  hunt_date date not null,
  boss_key text not null,
  boss_name text not null,
  boss_title text not null,
  boss_max_hp integer not null check (boss_max_hp between 1 and 500),
  boss_hp integer not null check (boss_hp between 0 and 500),
  player_hp integer not null default 5 check (player_hp between 0 and 10),
  resolve integer not null default 0 check (resolve between 0 and 6),
  prep_damage_applied integer not null default 0 check (prep_damage_applied between 0 and 500),
  prep_resolve_earned integer not null default 0 check (prep_resolve_earned between 0 and 6),
  turn integer not null default 0 check (turn between 0 and 30),
  status text not null default 'ready' check (status in ('ready', 'active', 'victory', 'defeat')),
  companion_slug text not null default 'seraphine',
  battle_log jsonb not null default '[]'::jsonb check (jsonb_typeof(battle_log) = 'array'),
  trophy_key text,
  trophy_name text,
  victory_gold integer not null default 0 check (victory_gold between 0 and 500),
  reward_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, hunt_date)
);

alter table public.daily_hunts enable row level security;

revoke all on table public.daily_hunts from anon, authenticated;
grant select, insert, update, delete on table public.daily_hunts to authenticated;

drop policy if exists daily_hunts_select_own on public.daily_hunts;
drop policy if exists daily_hunts_insert_own on public.daily_hunts;
drop policy if exists daily_hunts_update_own on public.daily_hunts;
drop policy if exists daily_hunts_delete_own on public.daily_hunts;

create policy daily_hunts_select_own on public.daily_hunts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy daily_hunts_insert_own on public.daily_hunts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy daily_hunts_update_own on public.daily_hunts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy daily_hunts_delete_own on public.daily_hunts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists daily_hunts_user_status_idx
  on public.daily_hunts (user_id, status, hunt_date desc);

-- Existing shared timestamp trigger.
drop trigger if exists set_daily_hunts_updated_at on public.daily_hunts;
create trigger set_daily_hunts_updated_at
before update on public.daily_hunts
for each row execute function public.set_updated_at();
