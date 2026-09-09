-- Keep scheduled outreach bookkeeping consistent even when older application
-- code only stamps sent_at. The database owns the invariant.

begin;

create or replace function public.sync_scheduled_outreach_delivery_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sent_at is not null then
    new.status := 'sent';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_scheduled_outreach_delivery_state on public.scheduled_outreach;
create trigger sync_scheduled_outreach_delivery_state
before insert or update of sent_at, status on public.scheduled_outreach
for each row execute function public.sync_scheduled_outreach_delivery_state();

update public.scheduled_outreach
set status = 'sent'
where sent_at is not null and status <> 'sent';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.scheduled_outreach'::regclass
      and conname = 'scheduled_outreach_sent_state_consistent'
  ) then
    alter table public.scheduled_outreach
      add constraint scheduled_outreach_sent_state_consistent
      check (sent_at is null or status = 'sent');
  end if;
end $$;

revoke all on function public.sync_scheduled_outreach_delivery_state()
from public, anon, authenticated;

commit;
