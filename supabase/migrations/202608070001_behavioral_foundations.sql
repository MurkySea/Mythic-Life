begin;

alter table public.tasks
  add column if not exists activity_kind text,
  add column if not exists priority_score smallint not null default 5,
  add column if not exists effort_minutes integer not null default 30,
  add column if not exists progress_current numeric not null default 0,
  add column if not exists progress_target numeric not null default 1;

update public.tasks
set activity_kind = case
  when lower(coalesce(recurrence, 'none')) in ('daily', 'weekly') then 'ritual'
  else 'quest'
end
where activity_kind is null;

alter table public.tasks
  alter column activity_kind set default 'quest',
  alter column activity_kind set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_activity_kind_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_activity_kind_check
      check (activity_kind in ('ritual', 'quest'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tasks_behavioral_ranges_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_behavioral_ranges_check
      check (
        priority_score between 1 and 10
        and effort_minutes > 0
        and progress_current >= 0
        and progress_target > 0
      );
  end if;
end
$$;

create table if not exists public.life_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  state text not null default 'stable'
    check (state in ('thriving', 'stable', 'neglected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists public.ritual_chains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.ritual_chain_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chain_id uuid not null,
  task_id uuid not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (chain_id, task_id),
  unique (chain_id, position),
  foreign key (chain_id, user_id)
    references public.ritual_chains(id, user_id) on delete cascade
);

create table if not exists public.momentum_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_type text not null check (scope_type in ('global', 'domain', 'ritual')),
  scope_key text not null,
  score numeric not null default 0 check (score between 0 and 100),
  band text not null default 'Dormant'
    check (band in ('Dormant', 'Stirring', 'Building', 'Momentum', 'Flow', 'Ascendant')),
  last_action_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, scope_type, scope_key)
);

create table if not exists public.behavioral_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dimensions jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.behavioral_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  strength numeric not null check (strength between 0 and 1),
  evidence jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  consumed_at timestamptz
);

create table if not exists public.action_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  action_type text not null,
  reward jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, source_type, source_id, action_type)
);

create table if not exists public.world_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_receipt_id uuid,
  kind text not null,
  state text not null default 'discovered'
    check (state in ('discovered', 'seen', 'resolved', 'expired')),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (source_receipt_id, user_id)
    references public.action_receipts(id, user_id) on delete restrict
);

create index if not exists behavioral_signals_owner_recent_idx
  on public.behavioral_signals (user_id, observed_at desc);
create index if not exists world_events_owner_recent_idx
  on public.world_events (user_id, occurred_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'life_domains',
    'ritual_chains',
    'ritual_chain_steps',
    'momentum_states',
    'behavioral_profiles',
    'behavioral_signals',
    'action_receipts',
    'world_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Owner access" on public.%I', table_name);
    execute format(
      'create policy "Owner access" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      table_name
    );
  end loop;
end
$$;

commit;
