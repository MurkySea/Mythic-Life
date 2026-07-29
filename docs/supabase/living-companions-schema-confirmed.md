# Living Companions — confirmed production schema

Confirmed by the Supabase Agent on 2026-07-29 after inspecting and applying changes to the live project.

## Existing companion identity

- Table: `public.companion`
- Primary key: `id uuid`

## Persistent character state

- Table: `public.companion_character_state`
- Owner column: `user_id`
- Companion reference: `companion_id -> public.companion(id)`
- State payload: `state jsonb`
- One state row per user and companion
- RLS enabled with owner-only policies
- Indexed for owner/companion lookup
- Reusable `updated_at` trigger attached

## Companion memories

Existing `public.companion_memories` was extended rather than replaced.

Confirmed added/reused fields include:

- `user_id`
- `companion_id`
- `summary`
- `kind`
- `importance_score`
- `confidence_score`
- `tags`
- `expires_at`
- `updated_at`
- `last_recalled_at`
- `recall_count`

RLS is enabled with owner-only policies. Existing memory content was preserved.

## Scheduled outreach

Existing `public.scheduled_outreach` was extended rather than replaced.

Confirmed added/reused fields include:

- `user_id`
- `companion_id`
- `reason`
- `message_seed`
- `status`
- `dedup_key`
- `sent_at`

RLS is enabled with owner-only policies and indexes support due pending-outreach queries.

## Integration note

The Supabase summary confirms the logical contract above, but the exact applied SQL and any pre-existing required columns should still be consulted before writing memory or outreach inserts that depend on legacy non-null fields.