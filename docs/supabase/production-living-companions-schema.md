# Production Living Companions Schema

Captured from the Supabase Agent inspection on 2026-07-29.

## Canonical companion identity

Use `public.companion.id` (`uuid`) as the stable companion identifier. `slug` remains useful for routing and display but is not currently enforced as unique.

## public.companion_character_state

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null`
- `companion_id uuid not null`
- `companion_slug text not null`
- `state jsonb not null default '{}'::jsonb`
- `version integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

RLS is enabled with authenticated owner-only SELECT/INSERT/UPDATE/DELETE policies using `user_id = auth.uid()`.

Inspection did not surface the previously claimed foreign key, unique constraint, indexes, or updated-at trigger. Treat those as unverified until a direct catalog inspection confirms them.

## public.companion_memories

Relevant columns:

- `id uuid primary key default gen_random_uuid()`
- `companion_slug text not null`
- `content text not null`
- `source text`
- `created_at timestamptz default now()`
- `user_id uuid`
- `companion_id uuid`
- `kind text`
- `summary text`
- `importance_score integer`
- `confidence_score integer`
- `tags text[]`
- `expires_at timestamptz`
- `updated_at timestamptz not null default now()`
- `last_recalled_at timestamptz`
- `recall_count integer not null`

RLS is enabled with authenticated owner-only policies.

## public.scheduled_outreach

Relevant columns:

- `id uuid primary key default gen_random_uuid()`
- `kind text not null`
- `companion_slug text not null`
- `send_after timestamptz not null`
- `payload jsonb default '{}'::jsonb`
- `bypass_cap boolean default false`
- `sent_at timestamptz`
- `created_at timestamptz default now()`
- `user_id uuid`
- `companion_id uuid`
- `reason text`
- `message_seed text`
- `status text not null default 'pending'`
- `dedup_key text`
- `updated_at timestamptz not null default now()`

RLS is enabled with authenticated owner-only policies.

## public.messages security warning

`public.messages` currently has no `user_id` and an RLS policy named `Allow all on messages` granting `ALL` to `public` with `using (true)` and `check (true)`.

That means the current schema report describes the conversation table as publicly readable and writable through the API. This must be corrected before relying on it for private persistent companion memory.

## Required follow-up before live integration

Use a direct PostgreSQL catalog inspection to confirm or create:

- foreign keys from the three user-owned tables to `auth.users(id)` and `public.companion(id)`
- unique state constraint on `(user_id, companion_id)`
- indexes for state lookup, ranked/recent memory retrieval, and due outreach
- score check constraints
- outreach status check constraint
- updated-at triggers
- a safe ownership model for `messages`

Application code should not assume these unreported database objects exist until verified.
