create table if not exists public.daily_rituals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ritual_date date not null,
  morning_companion_slug text not null default 'seraphine',
  main_quest_task_id uuid null references public.tasks(id) on delete set null,
  main_quest_title text null,
  morning_intention text null,
  morning_resistance text null,
  morning_identity text null,
  morning_response text null,
  morning_completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_rituals_user_date_key unique (user_id, ritual_date)
);

create index if not exists daily_rituals_user_date_idx
  on public.daily_rituals (user_id, ritual_date desc);

alter table public.daily_rituals enable row level security;

revoke all on table public.daily_rituals from anon, authenticated;
grant select, insert, update, delete on table public.daily_rituals to authenticated;

drop policy if exists "daily_rituals_owner_select" on public.daily_rituals;
create policy "daily_rituals_owner_select"
  on public.daily_rituals for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "daily_rituals_owner_insert" on public.daily_rituals;
create policy "daily_rituals_owner_insert"
  on public.daily_rituals for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_rituals_owner_update" on public.daily_rituals;
create policy "daily_rituals_owner_update"
  on public.daily_rituals for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_rituals_owner_delete" on public.daily_rituals;
create policy "daily_rituals_owner_delete"
  on public.daily_rituals for delete
  to authenticated
  using ((select auth.uid()) = user_id);
