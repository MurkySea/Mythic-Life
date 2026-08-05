begin;

do $$
declare
  sole_user_id uuid;
  null_count bigint;
  user_count bigint;
begin
  select count(*) into null_count
  from public.conversation_reads
  where user_id is null;

  if null_count > 0 then
    select count(*) into user_count
    from auth.users;

    if user_count = 1 then
      select id into sole_user_id
      from auth.users
      limit 1;

      update public.conversation_reads
      set user_id = sole_user_id
      where user_id is null;
    else
      raise exception
        'Cannot enforce conversation_reads.user_id NOT NULL: % rows have no owner and auth.users contains % users',
        null_count,
        user_count;
    end if;
  end if;
end
$$;

alter table public.conversation_reads
  alter column user_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_index index_definition
    join pg_class index_relation
      on index_relation.oid = index_definition.indexrelid
    join pg_class table_relation
      on table_relation.oid = index_definition.indrelid
    join pg_namespace table_namespace
      on table_namespace.oid = table_relation.relnamespace
    where table_namespace.nspname = 'public'
      and table_relation.relname = 'conversation_reads'
      and index_relation.relname = 'conversation_reads_owner_companion_key'
      and index_definition.indisunique
      and pg_get_indexdef(index_definition.indexrelid)
        like '%(user_id, companion_slug)%'
  ) then
    raise exception
      'Expected unique index conversation_reads_owner_companion_key on public.conversation_reads (user_id, companion_slug)';
  end if;
end
$$;

commit;
