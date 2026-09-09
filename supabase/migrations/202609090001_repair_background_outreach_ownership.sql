-- Background outreach is invoked without a browser auth session. Keep normal
-- user traffic RLS-scoped, while allowing trusted service-role jobs to resolve
-- the single configured app owner and the canonical companion row.

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, mythic_private
as $$
  select coalesce(
    auth.uid(),
    (select ao.user_id from mythic_private.app_owner ao limit 1)
  )
$$;

revoke all on function public.current_app_user_id() from public, anon;
grant execute on function public.current_app_user_id() to authenticated, service_role;

alter table public.messages
  alter column user_id set default public.current_app_user_id();

alter table public.scheduled_outreach
  alter column user_id set default public.current_app_user_id();

create or replace function public.fill_scheduled_outreach_companion_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.companion_id is null then
    select c.id
      into new.companion_id
    from public.companion c
    where c.slug = new.companion_slug
       or (new.companion_slug = 'seraphine' and c.name = 'Seraphine')
    order by
      case when c.slug = new.companion_slug then 0 else 1 end,
      c.affinity_score desc nulls last,
      c.bond_xp desc nulls last,
      c.created_at asc,
      c.id asc
    limit 1;
  end if;

  if new.companion_id is null then
    raise exception 'No companion row found for slug %', new.companion_slug
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.fill_scheduled_outreach_companion_id() from public, anon;
grant execute on function public.fill_scheduled_outreach_companion_id() to authenticated, service_role;

drop trigger if exists fill_scheduled_outreach_companion_id on public.scheduled_outreach;
create trigger fill_scheduled_outreach_companion_id
before insert or update of companion_slug, companion_id
on public.scheduled_outreach
for each row
execute function public.fill_scheduled_outreach_companion_id();
