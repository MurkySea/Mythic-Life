-- Canonical companion reset / identity hardening.
-- Intentional one-time reset: relationship/chat/memory/outreach state is discarded,
-- while productivity data and push subscriptions are preserved.

begin;

-- Clear companion-owned state before replacing duplicate identities.
delete from public.scheduled_outreach;
delete from public.companion_memories;
delete from public.companion_character_state;
delete from public.conversation_reads;
delete from public.messages;
delete from public.push_log;
delete from public.daily_rituals;
delete from public.companion;

-- Trust / Intimacy are the authoritative relationship axes from this point on.
alter table public.companion alter column slug set not null;
alter table public.companion alter column trust_score set default 0;
alter table public.companion alter column intimacy_score set default 0;
alter table public.companion alter column trust_score set not null;
alter table public.companion alter column intimacy_score set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.companion'::regclass
      and conname = 'companion_slug_unique'
  ) then
    alter table public.companion
      add constraint companion_slug_unique unique (slug);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.companion'::regclass
      and conname = 'companion_trust_score_range'
  ) then
    alter table public.companion
      add constraint companion_trust_score_range
      check (trust_score >= 0 and trust_score <= 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.companion'::regclass
      and conname = 'companion_intimacy_score_range'
  ) then
    alter table public.companion
      add constraint companion_intimacy_score_range
      check (intimacy_score >= 0 and intimacy_score <= 100);
  end if;
end $$;

create index if not exists companion_memories_companion_id_idx
  on public.companion_memories (companion_id);
create index if not exists scheduled_outreach_companion_id_idx
  on public.scheduled_outreach (companion_id);
drop index if exists public.messages_user_companion_created_idx;

-- Story-canon baselines: progress resets, canon does not.
-- Elowen has old trust from shared history, but the adult bond is still developing.
insert into public.companion (
  name, slug, title, race, personality, affinities, is_unlocked,
  affinity_score, bond_xp, intimacy, mood,
  trust_score, intimacy_score, consecutive_bad_days, consecutive_good_days
) values (
  'Elowen', 'seraphine', 'The Unbound', 'Celestial-Fae',
  'Warm, observant, quietly stubborn, playful, and emotionally honest. Old trust; adult closeness still taking shape.',
  array['faith','knowledge','relations']::text[], true,
  1, 0, 0, 'steady',
  65, 35, 0, 0
), (
  'Seraphine', 'seraphine_quietflame', 'Quiet Flame', 'Silver Foxkin',
  'Calm, warm, quietly strong. Notices consistency more than intensity and learns trust from what actually happens.',
  array['faith','discipline']::text[], true,
  1, 0, 0, 'steady',
  20, 8, 0, 0
);

-- Browser inserts use auth.uid(); server/service inserts are filled by private
-- trigger logic instead of exposing a SECURITY DEFINER RPC helper.
alter table public.messages alter column user_id set default auth.uid();
alter table public.scheduled_outreach alter column user_id set default auth.uid();

create or replace function public.fill_message_owner_id()
returns trigger
language plpgsql
security definer
set search_path = public, auth, mythic_private
as $$
begin
  if new.user_id is null then
    new.user_id := coalesce(
      auth.uid(),
      (select ao.user_id from mythic_private.app_owner ao limit 1)
    );
  end if;

  if new.user_id is null then
    raise exception 'Unable to resolve message owner' using errcode = '23502';
  end if;

  return new;
end;
$$;

drop trigger if exists fill_message_owner_id on public.messages;
create trigger fill_message_owner_id
before insert on public.messages
for each row execute function public.fill_message_owner_id();

-- Replace the legacy ambiguous name fallback with strict slug identity.
create or replace function public.fill_scheduled_outreach_companion_id()
returns trigger
language plpgsql
security definer
set search_path = public, auth, mythic_private
as $$
begin
  if new.user_id is null then
    new.user_id := coalesce(
      auth.uid(),
      (select ao.user_id from mythic_private.app_owner ao limit 1)
    );
  end if;

  if new.companion_id is null then
    select c.id into new.companion_id
    from public.companion c
    where c.slug = new.companion_slug
    limit 1;
  end if;

  if new.user_id is null then
    raise exception 'Unable to resolve outreach owner' using errcode = '23502';
  end if;

  if new.companion_id is null then
    raise exception 'No canonical companion found for slug %', new.companion_slug
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create or replace function public.fill_companion_memory_identity()
returns trigger
language plpgsql
security definer
set search_path = public, auth, mythic_private
as $$
begin
  if new.user_id is null then
    new.user_id := coalesce(
      auth.uid(),
      (select ao.user_id from mythic_private.app_owner ao limit 1)
    );
  end if;

  if new.companion_id is null then
    select c.id into new.companion_id
    from public.companion c
    where c.slug = new.companion_slug
    limit 1;
  end if;

  if new.user_id is null then
    raise exception 'Unable to resolve memory owner' using errcode = '23502';
  end if;

  if new.companion_id is null then
    raise exception 'No canonical companion found for slug %', new.companion_slug
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists fill_companion_memory_identity on public.companion_memories;
create trigger fill_companion_memory_identity
before insert or update of companion_slug, companion_id on public.companion_memories
for each row execute function public.fill_companion_memory_identity();

-- Temporary compatibility guard for the legacy fallback still present in the
-- large server action. It suppresses only the known wrong Seraphine/legacy-slug
-- insert; every other duplicate is rejected by companion_slug_unique.
create or replace function public.guard_legacy_seraphine_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug = 'seraphine'
     and new.name = 'Seraphine'
     and exists (
       select 1 from public.companion c
       where c.slug = 'seraphine' and c.name = 'Elowen'
     ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_legacy_seraphine_insert on public.companion;
create trigger guard_legacy_seraphine_insert
before insert on public.companion
for each row execute function public.guard_legacy_seraphine_insert();

-- These are trigger implementation details, not public RPCs.
revoke all on function public.fill_message_owner_id() from public, anon, authenticated;
revoke all on function public.fill_scheduled_outreach_companion_id() from public, anon, authenticated;
revoke all on function public.fill_companion_memory_identity() from public, anon, authenticated;
revoke all on function public.guard_legacy_seraphine_insert() from public, anon, authenticated;

-- Remove the emergency public helper after its defaults have been replaced.
drop function if exists public.current_app_user_id();

-- Collapse duplicate message policies and use init-plan-friendly auth checks.
drop policy if exists "Owner can read messages" on public.messages;
drop policy if exists "Owner can insert messages" on public.messages;
drop policy if exists "Owner can update messages" on public.messages;
drop policy if exists "Owner can delete messages" on public.messages;
drop policy if exists messages_owner_select on public.messages;
drop policy if exists messages_owner_insert on public.messages;
drop policy if exists messages_owner_update on public.messages;
drop policy if exists messages_owner_delete on public.messages;
create policy messages_owner_select on public.messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy messages_owner_insert on public.messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy messages_owner_update on public.messages for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_owner_delete on public.messages for delete to authenticated
  using (user_id = (select auth.uid()));

-- Optimize the companion-owned RLS policies while preserving behavior.
drop policy if exists companion_character_state_select_own on public.companion_character_state;
drop policy if exists companion_character_state_insert_own on public.companion_character_state;
drop policy if exists companion_character_state_update_own on public.companion_character_state;
drop policy if exists companion_character_state_delete_own on public.companion_character_state;
create policy companion_character_state_select_own on public.companion_character_state for select to authenticated
  using (user_id = (select auth.uid()));
create policy companion_character_state_insert_own on public.companion_character_state for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy companion_character_state_update_own on public.companion_character_state for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy companion_character_state_delete_own on public.companion_character_state for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists companion_memories_select_own on public.companion_memories;
drop policy if exists companion_memories_insert_own on public.companion_memories;
drop policy if exists companion_memories_update_own on public.companion_memories;
drop policy if exists companion_memories_delete_own on public.companion_memories;
create policy companion_memories_select_own on public.companion_memories for select to authenticated
  using (user_id = (select auth.uid()));
create policy companion_memories_insert_own on public.companion_memories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy companion_memories_update_own on public.companion_memories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy companion_memories_delete_own on public.companion_memories for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists scheduled_outreach_select_own on public.scheduled_outreach;
drop policy if exists scheduled_outreach_insert_own on public.scheduled_outreach;
drop policy if exists scheduled_outreach_update_own on public.scheduled_outreach;
drop policy if exists scheduled_outreach_delete_own on public.scheduled_outreach;
create policy scheduled_outreach_select_own on public.scheduled_outreach for select to authenticated
  using (user_id = (select auth.uid()));
create policy scheduled_outreach_insert_own on public.scheduled_outreach for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy scheduled_outreach_update_own on public.scheduled_outreach for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy scheduled_outreach_delete_own on public.scheduled_outreach for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owner can read conversation reads" on public.conversation_reads;
drop policy if exists "Owner can insert conversation reads" on public.conversation_reads;
drop policy if exists "Owner can update conversation reads" on public.conversation_reads;
drop policy if exists "Owner can delete conversation reads" on public.conversation_reads;
create policy "Owner can read conversation reads" on public.conversation_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Owner can insert conversation reads" on public.conversation_reads for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Owner can update conversation reads" on public.conversation_reads for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Owner can delete conversation reads" on public.conversation_reads for delete to authenticated
  using (user_id = (select auth.uid()));

commit;
