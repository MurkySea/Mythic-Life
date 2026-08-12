begin;

alter table public.habit_logs
  add column outcome text
  check (outcome is null or outcome in ('completed', 'missed'));

update public.habit_logs
set outcome = 'completed'
where completed = true;

create or replace function public.sync_habit_log_outcome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.completed then
    new.outcome := 'completed';
  elsif new.outcome = 'completed' then
    new.outcome := null;
  end if;
  return new;
end;
$$;

create trigger habit_logs_sync_outcome
before insert or update on public.habit_logs
for each row execute function public.sync_habit_log_outcome();

create or replace function public.set_habit_outcome(
  p_habit_id uuid,
  p_logged_date date,
  p_outcome text
)
returns table (
  log_id uuid,
  current_outcome text,
  is_completed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (clock_timestamp() at time zone 'America/Chicago')::date;
  v_log public.habit_logs%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_logged_date is distinct from v_today then
    raise exception 'Habit outcome can only be changed for today';
  end if;

  if p_outcome not in ('missed', 'unlogged') then
    raise exception 'Invalid habit outcome';
  end if;

  if not exists (
    select 1
    from public.habits habit
    where habit.id = p_habit_id
      and habit.user_id = v_user_id
      and habit.is_active = true
  ) then
    raise exception 'Habit not found';
  end if;

  if p_outcome = 'missed' and exists (
    select 1
    from public.habit_sessions session
    where session.habit_id = p_habit_id
      and session.user_id = v_user_id
      and session.status in ('running', 'paused')
  ) then
    raise exception 'Finish the active timer before marking this habit missed';
  end if;

  if p_outcome = 'missed' then
    insert into public.habit_logs (
      user_id,
      habit_id,
      logged_date,
      outcome,
      completed,
      completed_at
    )
    values (
      v_user_id,
      p_habit_id,
      p_logged_date,
      'missed',
      false,
      null
    )
    on conflict (user_id, habit_id, logged_date)
    do update set
      outcome = 'missed',
      completed = false,
      completed_at = null
    returning * into v_log;
  else
    update public.habit_logs
    set outcome = case when completed then 'completed' else null end
    where user_id = v_user_id
      and habit_id = p_habit_id
      and logged_date = p_logged_date
    returning * into v_log;

    if not found then
      return;
    end if;
  end if;

  return query
  select v_log.id, v_log.outcome, v_log.completed;
end;
$$;

revoke all on function public.set_habit_outcome(uuid, date, text) from public, anon;
grant execute on function public.set_habit_outcome(uuid, date, text) to authenticated;

commit;
