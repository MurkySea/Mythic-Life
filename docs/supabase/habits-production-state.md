# Habits production migration state

## 2026-08-11 production install

The schema and RPCs represented by `supabase/migrations/202608110001_add_habits_training.sql` were applied to production manually in reviewed steps rather than by a single Supabase CLI migration run.

Confirmed during the production install:

- `public.habits`, `public.habit_logs`, `public.habit_sessions`, and `public.habit_events` exist.
- RLS is enabled with owner-scoped policies.
- `record_habit_progress`, `start_habit_session`, `pause_habit_session`, `resume_habit_session`, and `finish_habit_session` were installed using the definitions from the repository migration.
- RPC execution was revoked from `public` and `anon` and granted to `authenticated`.
- Legacy habit RPC overloads were dependency-audited and removed before the current signatures were installed.

## Important migration-history warning

Because the migration was applied manually in pieces, the remote Supabase migration-history table may not automatically show `202608110001` as applied.

Before running a future `supabase db push`, verify remote migration history. If `202608110001` is absent even though the objects above are present, reconcile the remote history first rather than allowing the migration to rerun against existing production objects.

Typical linked-project CLI reconciliation is:

```bash
supabase migration repair --status applied 202608110001
```

Run that only after confirming the linked project is the intended production project and the migration objects above are present. Do not rerun the migration merely to make history match.
