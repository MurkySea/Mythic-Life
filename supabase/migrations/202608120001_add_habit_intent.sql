begin;

alter table public.habits
  add column intent text not null default 'build'
  check (intent in ('build', 'avoid'));

create or replace function public.set_habit_outcome(
  p_habit_id uuid,
  p_logged_date date,
  p_outcome text
)
returns table (
  log_id uuid,
  current_outcome text,
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
  v_today date := (clock_timestamp() at time zone 'America/Chicago')::date;
  v_habit public.habits%rowtype;
  v_log public.habit_logs%rowtype;
  v_rewarded boolean := false;
  v_xp integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_logged_date is distinct from v_today then
    raise exception 'Habit outcome can only be changed for today';
  end if;

  if p_outcome not in ('completed', 'missed', 'unlogged') then
    raise exception 'Invalid habit outcome';
  end if;

  select * into v_habit
  from public.habits habit
  where habit.id = p_habit_id
    and habit.user_id = v_user_id
    and habit.is_active = true
  for update;

  if not found then
    raise exception 'Habit not found';
  end if;

  if p_outcome = 'completed' and v_habit.intent <> 'avoid' then
    raise exception 'Build habits are completed through their tracking action';
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

  if p_outcome in ('completed', 'missed') then
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
      case when p_outcome = 'completed' then 'completed' else 'missed' end,
      p_outcome = 'completed',
      case when p_outcome = 'completed' then clock_timestamp() else null end
    )
    on conflict (user_id, habit_id, logged_date)
    do update set
      outcome = case when p_outcome = 'completed' then 'completed' else 'missed' end,
      completed = p_outcome = 'completed',
      completed_at = case
        when p_outcome = 'completed' then coalesce(public.habit_logs.completed_at, clock_timestamp())
        else null
      end
    returning * into v_log;

    if p_outcome = 'completed' and v_log.rewarded_at is null then
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
  select v_log.id, v_log.outcome, v_log.completed, v_rewarded, v_xp;
end;
$$;

revoke all on function public.set_habit_outcome(uuid, date, text) from public, anon;
grant execute on function public.set_habit_outcome(uuid, date, text) to authenticated;

commit;
