# Supabase Agent Prompt — Living Companions Foundation

Paste the full prompt below into the Supabase Agent for the Mythic Life project.

---

Inspect the existing Mythic Life database schema before changing anything. Preserve all current data and do not recreate tables, columns, indexes, functions, triggers, or policies that already satisfy the requirements.

Build the database foundation for persistent Living Companions.

## 1. Character state

Create a `companion_character_state` table only if no equivalent table already exists.

Required logical fields:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- a companion reference that matches the existing companion table's real primary-key type and column name
- `companion_slug text not null`
- `state jsonb not null default '{}'::jsonb`
- `version integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Add a unique constraint so each authenticated user has only one state row per companion.

Add useful indexes for user lookup and companion lookup.

The `state` JSON is expected to store mood, energy, stress, curiosity, confidence, relationship dimensions, current goals, unresolved thoughts, recent events, and an ISO `updatedAt` timestamp. Do not split those values into separate columns yet.

## 2. Companion memories

Inspect the existing `companion_memories` table. Reuse it rather than creating a competing memory table.

Add only missing columns needed to support:

- memory kind/category
- concise summary
- source text
- importance score from 0 to 100
- confidence score from 0 to 100
- tags as text array or jsonb, whichever best matches the existing table
- optional expiration timestamp
- created and updated timestamps
- optional last-recalled timestamp
- optional recall count with default 0

Keep existing memory content and existing column names when they already serve the same purpose. Add check constraints for bounded numeric scores where safe.

Add indexes that support retrieving a user's highest-importance memories for one companion, ordered by importance and recency.

## 3. Scheduled outreach

Inspect the existing `scheduled_outreach` table. Do not replace it.

Ensure it can support companion initiative with these logical fields, adding only what is missing:

- authenticated user ownership
- companion reference
- reason/type
- message seed or context
- scheduled time
- status such as pending, sent, cancelled, skipped, or failed
- deduplication key
- created, updated, and sent timestamps

Add an index suitable for finding due pending outreach.

## 4. Updated-at handling

Reuse an existing updated-at trigger function if one exists. Otherwise create one safe reusable trigger function and attach it only where needed.

## 5. Row Level Security

Enable RLS on any new table.

For every affected user-owned table, verify authenticated users can select, insert, update, and delete only rows where `user_id = auth.uid()`.

Do not create broad public policies. Do not expose service-role credentials. Preserve any stricter existing policy unless it prevents the authenticated owner from using their own records.

## 6. Compatibility and verification

Before applying changes:

- identify the real companion table name, primary key, and key type
- identify overlapping existing columns and reuse them
- avoid destructive renames or type changes
- do not drop data, tables, policies, or functions

Apply the migration, refresh the schema, and verify:

1. one character-state row per user and companion is enforced
2. memory importance/confidence are bounded from 0 to 100
3. due outreach can be queried efficiently
4. RLS blocks cross-user access
5. existing app tables and data remain intact

Return:

- a concise summary of what changed
- every table/column/index/policy/trigger created or reused
- the exact SQL that was applied
- any ambiguity or conflict you found

If the existing schema makes any requirement unsafe or unclear, stop and explain the conflict rather than forcing a destructive change.

---
