begin;

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  tracking_type text not null check (tracking_type in ('check', 'counter', 'timer', 'stopwatch')),
  target_value numeric(12, 2),
  target_unit text check (target_unit is null or char_length(target_unit) <= 40),
  target_seconds integer,
  frequency text not null default 'daily' check (frequency in ('daily', 'specific_days')),
  days_of_week smallint[] not null default array[0, 1, 2, 3, 4, 5, 6]::smallint[],
  xp_reward integer not null default 0 check (xp_reward between 0 and 100),
  skill_key text check (skill_key is null or skill_key in (
    'faith', 'discipline', 'fitness', 'knowledge',
    'relations', 'business', 'stewardship', 'wisdom'
  )),
  icon text not null default 'training' check (char_length(icon) between 1 and 40),
  is_impulse_resistance boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habits_owner_identity_key unique (id, user_id),
  constraint habits_schedule_days_valid check (
    cardinality(days_of_week) between 1 and 7
    and days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  constraint habits_targets_match_type check (
    (tracking_type = 'counter' and target_value is not null and target_value > 0)
    or (tracking_type = 'timer' and target_seconds is not null and target_seconds > 0)
    or tracking_type in ('check', 'stopwatch')
  ),
  constraint habits_impulse_is_counter check (
    not is_impulse_resistance or tracking_type = 'counter'
  )
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null,
  logged_date date not null,
  value numeric(12, 2) not null default 0 check (value >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  completed boolean not null default false,
  completed_at timestamptz,
  rewarded_at timestamptz,
  reward_xp integer not null default 0 check (reward_xp >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_logs_owner_identity_key unique (id, user_id),
  constraint habit_logs_owner_day_key unique (user_id, habit_id, logged_date),
  constraint habit_logs_owner_habit_fk foreign key (habit_id, user_id)
    references public.habits(id, user_id) on delete cascade,
  constraint habit_logs_completed_timestamp check (
    (completed and completed_at is not null) or (not completed and completed_at is null)
  )
);

create table public.habit_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null,
  logged_date date not null,
  started_at timestamptz not null default now(),
  active_started_at timestamptz,
  paused_at timestamptz,
  ended_at timestamptz,
  accumulated_seconds integer not null default 0 check (accumulated_seconds >= 0),
  final_duration_seconds integer check (final_duration_seconds is null or final_duration_seconds >= 0),
  status text not null default 'running' check (status in ('running', 'paused', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_sessions_owner_identity_key unique (id, user_id),
  constraint habit_sessions_owner_habit_fk foreign key (habit_id, user_id)
    references public.habits(id, user_id) on delete cascade,
  constraint habit_sessions_state_valid check (
    (status = 'running' and active_started_at is not null and paused_at is null and ended_at is null and final_duration_seconds is null)
    or (status = 'paused' and active_started_at is null and paused_at is not null and ended_at is null and final_duration_seconds is null)
    or (status = 'finished' and active_started_at is null and ended_at is not null and final_duration_seconds is not null)
  )
);

create table public.habit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null,
  log_id uuid not null,
  session_id uuid,
  request_id uuid,
  logged_date date not null,
  event_type text not null check (event_type in ('check', 'counter', 'timer', 'stopwatch')),
  value numeric(12, 2) not null default 0 check (value >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  impulse_category text check (impulse_category is null or impulse_category in (
    'scrolling', 'food', 'spending', 'sexual', 'anger', 'other'
  )),
  created_at timestamptz not null default now(),
  constraint habit_events_owner_habit_fk foreign key (habit_id, user_id)
    references public.habits(id, user_id) on delete cascade,
  constraint habit_events_owner_log_fk foreign key (log_id, user_id)
    references public.habit_logs(id, user_id) on delete cascade,
  constraint habit_events_owner_session_fk foreign key (session_id, user_id)
    references public.habit_sessions(id, user_id) on delete cascade
);

create index habits_owner_active_sort_idx
  on public.habits (user_id, is_active, sort_order, created_at);
create index habit_logs_owner_recent_idx
  on public.habit_logs (user_id, logged_date desc);
create index habit_logs_habit_recent_idx
  on public.habit_logs (habit_id, logged_date desc);
create index habit_sessions_owner_recent_idx
  on public.habit_sessions (user_id, started_at desc);
create unique index habit_sessions_one_active_per_habit_idx
  on public.habit_sessions (user_id, habit_id)
  where status in ('running', 'paused');
create index habit_events_owner_recent_idx
  on public.habit_events (user_id, created_at desc);
create index habit_events_impulse_trend_idx
  on public.habit_events (user_id, habit_id, logged_date desc)
  where impulse_category is not null;
create unique index habit_events_owner_request_key
  on public.habit_events (user_id, request_id)
  where request_id is not null;
create unique index habit_events_session_key
  on public.habit_events (session_id)
  where session_id is not null;

create or replace function public.set_habit_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_active_habit_session()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'Habit ownership cannot be transferred';
  end if;

  if exists (
    select 1 from public.habit_sessions session
    where session.habit_id = old.id
      and session.user_id = old.user_id
      and session.status in ('running', 'paused')
  ) and (
    new.tracking_type is distinct from old.tracking_type
    or new.target_seconds is distinct from old.target_seconds
    or new.is_active is distinct from old.is_active
  ) then
    raise exception 'Finish the active timer before changing its configuration';
  end if;
  return new;
end;
$$;

create trigger habits_protect_active_session
before update on public.habits
for each row execute function public.protect_active_habit_session();

create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_habit_updated_at();

create trigger habit_logs_set_updated_at
before update on public.habit_logs
for each row execute function public.set_habit_updated_at();

create trigger habit_sessions_set_updated_at
before update on public.habit_sessions
for each row execute function public.set_habit_updated_at();

alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.habit_sessions enable row level security;
alter table public.habit_events enable row level security;

revoke all on public.habits, public.habit_logs, public.habit_sessions, public.habit_events from anon, authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select on public.habit_logs, public.habit_sessions, public.habit_events to authenticated;

create policy "Owner can read habits" on public.habits
  for select to authenticated using (user_id = auth.uid());
create policy "Owner can insert habits" on public.habits
  for insert to authenticated with check (user_id = auth.uid());
create policy "Owner can update habits" on public.habits
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owner can delete habits" on public.habits
  for delete to authenticated using (user_id = auth.uid());

create policy "Owner can read habit logs" on public.habit_logs
  for select to authenticated using (user_id = auth.uid());
create policy "Owner can insert habit logs" on public.habit_logs
  for insert to authenticated with check (user_id = auth.uid());
create policy "Owner can update habit logs" on public.habit_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owner can delete habit logs" on public.habit_logs
  for delete to authenticated using (user_id = auth.uid());

create policy "Owner can read habit sessions" on public.habit_sessions
  for select to authenticated using (user_id = auth.uid());
create policy "Owner can insert habit sessions" on public.habit_sessions
  for insert to authenticated with check (user_id = auth.uid());
create policy "Owner can update habit sessions" on public.habit_sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owner can delete habit sessions" on public.habit_sessions
  for delete to authenticated using (user_id = auth.uid());

create policy "Owner can read habit events" on public.habit_events
  for select to authenticated using (user_id = auth.uid());
create policy "Owner can insert habit events" on public.habit_events
  for insert to authenticated with check (user_id = auth.uid());
create policy "Owner can update habit events" on public.habit_events
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owner can delete habit events" on public.habit_events
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.record_habit_progress(
  p_habit_id uuid,
  p_logged_date date,
  p_request_id uuid,
  p_impulse_category text default null
)
returns table (
  log_id uuid,
  current_value numeric,
  current_duration_seconds integer,
  is_completed boolean,
  reward_awarded boolean,
  xp_awarded integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_habit public.habits%rowtype;
  v_log public.habit_logs%rowtype;
  v_existing_log_id uuid;
  v_completed boolean;
  v_rewarded boolean := false;
  v_xp integer := 0;
  v_today date := (clock_timestamp() at time zone 'America/Chicago')::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_request_id is null then raise exception 'Request identifier required'; end if;
  if p_logged_date <> v_today then raise exception 'Progress must use the current Chicago day'; end if;

  select event.log_id into v_existing_log_id
  from public.habit_events event
  where event.user_id = v_user_id and event.request_id = p_request_id;

  if v_existing_log_id is not null then
    select * into v_log
    from public.habit_logs
    where id = v_existing_log_id and user_id = v_user_id;

    return query select v_log.id, v_log.value, v_log.duration_seconds,
      v_log.completed, false, 0;
    return;
  end if;

  select * into v_habit
  from public.habits
  where id = p_habit_id and user_id = v_user_id and is_active
  for update;

  if not found then
    raise exception 'Active habit not found';
  end if;
  if v_habit.tracking_type not in ('check', 'counter') then
    raise exception 'This habit requires a timer session';
  end if;
  if p_impulse_category is not null and p_impulse_category not in (
    'scrolling', 'food', 'spending', 'sexual', 'anger', 'other'
  ) then
    raise exception 'Invalid impulse category';
  end if;

  insert into public.habit_logs (user_id, habit_id, logged_date)
  values (v_user_id, p_habit_id, p_logged_date)
  on conflict (user_id, habit_id, logged_date) do nothing;

  select * into v_log
  from public.habit_logs
  where user_id = v_user_id and habit_id = p_habit_id and logged_date = p_logged_date
  for update;

  if v_habit.tracking_type = 'check' and v_log.completed then
    return query select v_log.id, v_log.value, v_log.duration_seconds,
      v_log.completed, false, 0;
    return;
  end if;

  if v_habit.tracking_type = 'check' then
    v_log.value := greatest(v_log.value, 1);
    v_completed := true;
  else
    v_log.value := v_log.value + 1;
    v_completed := v_log.value >= v_habit.target_value;
  end if;

  update public.habit_logs
  set value = v_log.value,
      completed = v_completed,
      completed_at = case
        when v_completed then coalesce(completed_at, clock_timestamp())
        else null
      end
  where id = v_log.id
  returning * into v_log;

  insert into public.habit_events (
    user_id, habit_id, log_id, request_id, logged_date, event_type,
    value, impulse_category
  ) values (
    v_user_id, p_habit_id, v_log.id, p_request_id, p_logged_date,
    v_habit.tracking_type, 1,
    case when v_habit.is_impulse_resistance then p_impulse_category else null end
  );

  if v_completed and v_log.rewarded_at is null then
    v_xp := v_habit.xp_reward;
    update public.habit_logs
    set rewarded_at = clock_timestamp(), reward_xp = v_xp
    where id = v_log.id
    returning * into v_log;
    v_rewarded := true;

    insert into public.player_standing (id, total_xp, updated_at)
    values ('solo', v_xp, clock_timestamp())
    on conflict (id) do update
    set total_xp = coalesce(public.player_standing.total_xp, 0) + excluded.total_xp,
        updated_at = excluded.updated_at;

    if v_habit.skill_key is not null and v_xp > 0 then
      insert into public.player_skills (skill, xp, level)
      values (v_habit.skill_key, v_xp, greatest(1, floor(v_xp / 50.0)::integer + 1))
      on conflict (skill) do update
      set xp = coalesce(public.player_skills.xp, 0) + excluded.xp,
          level = greatest(
            1,
            floor((coalesce(public.player_skills.xp, 0) + excluded.xp) / 50.0)::integer + 1
          );
    end if;
  end if;

  return query select v_log.id, v_log.value, v_log.duration_seconds,
    v_log.completed, v_rewarded, case when v_rewarded then v_xp else 0 end;
end;
$$;

create or replace function public.start_habit_session(
  p_habit_id uuid,
  p_logged_date date
)
returns public.habit_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.habit_sessions%rowtype;
  v_today date := (clock_timestamp() at time zone 'America/Chicago')::date;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_logged_date <> v_today then raise exception 'Sessions must use the current Chicago day'; end if;

  perform 1 from public.habits
  where id = p_habit_id and user_id = v_user_id and is_active
    and tracking_type in ('timer', 'stopwatch');
  if not found then raise exception 'Active timed habit not found'; end if;

  select * into v_session
  from public.habit_sessions
  where user_id = v_user_id and habit_id = p_habit_id
    and status in ('running', 'paused')
  order by started_at desc
  limit 1;
  if found then return v_session; end if;

  insert into public.habit_sessions (
    user_id, habit_id, logged_date, started_at, active_started_at, status
  ) values (
    v_user_id, p_habit_id, p_logged_date, clock_timestamp(), clock_timestamp(), 'running'
  ) returning * into v_session;

  return v_session;
exception
  when unique_violation then
    select * into v_session
    from public.habit_sessions
    where user_id = v_user_id and habit_id = p_habit_id
      and status in ('running', 'paused')
    order by started_at desc
    limit 1;
    return v_session;
end;
$$;

create or replace function public.pause_habit_session(p_session_id uuid)
returns public.habit_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.habit_sessions%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.habit_sessions
  where id = p_session_id and user_id = v_user_id for update;
  if not found then raise exception 'Timer session not found'; end if;
  if v_session.status = 'paused' then return v_session; end if;
  if v_session.status <> 'running' then raise exception 'Timer session has finished'; end if;

  update public.habit_sessions
  set accumulated_seconds = accumulated_seconds + greatest(
        0, floor(extract(epoch from (v_now - active_started_at)))::integer
      ),
      active_started_at = null,
      paused_at = v_now,
      status = 'paused'
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.resume_habit_session(p_session_id uuid)
returns public.habit_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.habit_sessions%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_session from public.habit_sessions
  where id = p_session_id and user_id = v_user_id for update;
  if not found then raise exception 'Timer session not found'; end if;
  if v_session.status = 'running' then return v_session; end if;
  if v_session.status <> 'paused' then raise exception 'Timer session has finished'; end if;

  update public.habit_sessions
  set active_started_at = clock_timestamp(), paused_at = null, status = 'running'
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

create or replace function public.finish_habit_session(
  p_session_id uuid,
  p_request_id uuid
)
returns table (
  finished_session_id uuid,
  final_duration_seconds integer,
  log_id uuid,
  daily_duration_seconds integer,
  is_completed boolean,
  reward_awarded boolean,
  xp_awarded integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.habit_sessions%rowtype;
  v_habit public.habits%rowtype;
  v_log public.habit_logs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_duration integer;
  v_completed boolean;
  v_rewarded boolean := false;
  v_xp integer := 0;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_request_id is null then raise exception 'Request identifier required'; end if;

  select * into v_session from public.habit_sessions
  where id = p_session_id and user_id = v_user_id for update;
  if not found then raise exception 'Timer session not found'; end if;

  select * into v_habit from public.habits
  where id = v_session.habit_id and user_id = v_user_id for update;
  if not found then raise exception 'Habit not found'; end if;

  if v_session.status = 'finished' then
    select * into v_log from public.habit_logs
    where user_id = v_user_id and habit_id = v_session.habit_id
      and logged_date = v_session.logged_date;
    return query select v_session.id, v_session.final_duration_seconds, v_log.id,
      v_log.duration_seconds, v_log.completed, false, 0;
    return;
  end if;

  v_duration := v_session.accumulated_seconds;
  if v_session.status = 'running' then
    v_duration := v_duration + greatest(
      0, floor(extract(epoch from (v_now - v_session.active_started_at)))::integer
    );
  end if;

  update public.habit_sessions
  set accumulated_seconds = v_duration,
      final_duration_seconds = v_duration,
      active_started_at = null,
      paused_at = case when status = 'paused' then paused_at else null end,
      ended_at = v_now,
      status = 'finished'
  where id = v_session.id
  returning * into v_session;

  insert into public.habit_logs (user_id, habit_id, logged_date)
  values (v_user_id, v_habit.id, v_session.logged_date)
  on conflict (user_id, habit_id, logged_date) do nothing;

  select * into v_log from public.habit_logs
  where user_id = v_user_id and habit_id = v_habit.id
    and logged_date = v_session.logged_date
  for update;

  v_log.duration_seconds := v_log.duration_seconds + v_duration;
  v_completed := case
    when v_habit.tracking_type = 'timer'
      then v_log.duration_seconds >= v_habit.target_seconds
    else v_log.duration_seconds > 0
  end;

  update public.habit_logs
  set duration_seconds = v_log.duration_seconds,
      completed = v_completed,
      completed_at = case
        when v_completed then coalesce(completed_at, v_now)
        else null
      end
  where id = v_log.id
  returning * into v_log;

  insert into public.habit_events (
    user_id, habit_id, log_id, session_id, request_id, logged_date,
    event_type, duration_seconds
  ) values (
    v_user_id, v_habit.id, v_log.id, v_session.id, p_request_id,
    v_session.logged_date, v_habit.tracking_type, v_duration
  );

  if v_completed and v_log.rewarded_at is null then
    v_xp := v_habit.xp_reward;
    update public.habit_logs
    set rewarded_at = v_now, reward_xp = v_xp
    where id = v_log.id
    returning * into v_log;
    v_rewarded := true;

    insert into public.player_standing (id, total_xp, updated_at)
    values ('solo', v_xp, v_now)
    on conflict (id) do update
    set total_xp = coalesce(public.player_standing.total_xp, 0) + excluded.total_xp,
        updated_at = excluded.updated_at;

    if v_habit.skill_key is not null and v_xp > 0 then
      insert into public.player_skills (skill, xp, level)
      values (v_habit.skill_key, v_xp, greatest(1, floor(v_xp / 50.0)::integer + 1))
      on conflict (skill) do update
      set xp = coalesce(public.player_skills.xp, 0) + excluded.xp,
          level = greatest(
            1,
            floor((coalesce(public.player_skills.xp, 0) + excluded.xp) / 50.0)::integer + 1
          );
    end if;
  end if;

  return query select v_session.id, v_duration, v_log.id,
    v_log.duration_seconds, v_log.completed, v_rewarded,
    case when v_rewarded then v_xp else 0 end;
end;
$$;

revoke all on function public.record_habit_progress(uuid, date, uuid, text) from public, anon;
revoke all on function public.start_habit_session(uuid, date) from public, anon;
revoke all on function public.pause_habit_session(uuid) from public, anon;
revoke all on function public.resume_habit_session(uuid) from public, anon;
revoke all on function public.finish_habit_session(uuid, uuid) from public, anon;
grant execute on function public.record_habit_progress(uuid, date, uuid, text) to authenticated;
grant execute on function public.start_habit_session(uuid, date) to authenticated;
grant execute on function public.pause_habit_session(uuid) to authenticated;
grant execute on function public.resume_habit_session(uuid) to authenticated;
grant execute on function public.finish_habit_session(uuid, uuid) to authenticated;

commit;
