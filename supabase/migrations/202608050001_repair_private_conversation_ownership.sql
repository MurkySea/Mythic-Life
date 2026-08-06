begin;

create table if not exists public.conversation_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  companion_slug text not null,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversation_reads
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  sole_user_id uuid;
begin
  if (select count(*) from auth.users) = 1 then
    select id into sole_user_id from auth.users limit 1;
    update public.conversation_reads set user_id = sole_user_id where user_id is null;
  end if;
end
$$;

create unique index if not exists conversation_reads_owner_companion_key
  on public.conversation_reads (user_id, companion_slug);
create index if not exists conversation_reads_owner_recent_idx
  on public.conversation_reads (user_id, last_read_at desc);

alter table public.conversation_reads enable row level security;
drop policy if exists "Owner can read conversation reads" on public.conversation_reads;
drop policy if exists "Owner can insert conversation reads" on public.conversation_reads;
drop policy if exists "Owner can update conversation reads" on public.conversation_reads;
drop policy if exists "Owner can delete conversation reads" on public.conversation_reads;
create policy "Owner can read conversation reads" on public.conversation_reads
  for select to authenticated using (user_id = auth.uid());
create policy "Owner can insert conversation reads" on public.conversation_reads
  for insert to authenticated with check (user_id = auth.uid());
create policy "Owner can update conversation reads" on public.conversation_reads
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owner can delete conversation reads" on public.conversation_reads
  for delete to authenticated using (user_id = auth.uid());

alter table public.messages
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages alter column user_id set default auth.uid();

do $$
declare
  sole_user_id uuid;
begin
  if (select count(*) from auth.users) = 1 then
    select id into sole_user_id from auth.users limit 1;
    update public.messages set user_id = sole_user_id where user_id is null;
  end if;
end
$$;

create index if not exists messages_owner_companion_recent_idx
  on public.messages (user_id, companion_slug, created_at desc);
alter table public.messages enable row level security;
drop policy if exists "Allow all on messages" on public.messages;
drop policy if exists "Owner can read messages" on public.messages;
drop policy if exists "Owner can insert messages" on public.messages;
drop policy if exists "Owner can update messages" on public.messages;
drop policy if exists "Owner can delete messages" on public.messages;
create policy "Owner can read messages" on public.messages
  for select to authenticated using (user_id = auth.uid());
create policy "Owner can insert messages" on public.messages
  for insert to authenticated with check (user_id = auth.uid());
create policy "Owner can update messages" on public.messages
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Owner can delete messages" on public.messages
  for delete to authenticated using (user_id = auth.uid());

commit;
