# Database schema: how it's managed

The live database is a single hand-managed Supabase Postgres project
(`uiuibwufzhirpntdtqpj`). There is no CI/deploy step that runs migrations —
changes are applied by hand (via the Supabase SQL editor or the MCP SQL tool)
and then captured into a migration file afterwards. Keep that order: apply,
verify, then write the migration that reproduces what you just did.

## Canonical source of truth

**`supabase/migrations/`** is canonical. It's a timestamp-ordered set of
`.sql` files, compatible with the [Supabase CLI](https://supabase.com/docs/guides/local-development)
(`supabase db push`, `supabase db diff`, `supabase db reset`) via
`supabase/config.toml` at the repo root. New schema changes go here.

## `db/schema-snapshot.sql` — generated, not hand-edited

A flattened, single-file snapshot of the live schema — every table, column,
constraint, index, function, view, trigger, and RLS policy — meant to be
pasted into a fresh Supabase project's SQL editor to bootstrap it in one
shot, without replaying the entire migration history by hand. **Generated.
Never hand-edit it.**

To regenerate it from the live database:

1. Dump `information_schema` / `pg_catalog` for the `public` schema: columns,
   constraints (`pg_get_constraintdef`), indexes (`pg_indexes`), functions
   (`pg_get_functiondef`), function privileges (`pg_proc.proacl`), views
   (`pg_get_viewdef`), triggers (`pg_get_triggerdef`), and RLS policies
   (`pg_policies`) — via the Supabase MCP `execute_sql` tool or the SQL
   editor.
2. Assemble those into DDL in dependency order: extensions → enum types →
   `create table` (bare) → primary/unique constraints → foreign keys → check
   constraints → indexes not already created by a constraint → functions →
   function privileges (`revoke all ... from public` + `grant execute ...`
   for every function whose `proacl` isn't null — Supabase revokes PUBLIC
   execute by default on new functions, and that's security-relevant: e.g.
   `delete_my_account()` must not be callable by `anon` on a fresh project
   either) → views → triggers → `enable row level security` → policies.
   Creating all tables before any constraint/FK avoids ordering issues
   between tables that reference each other.
3. Cross-check the result against `supabase/migrations/` — anything present
   live but not reachable by replaying the migrations in order is drift that
   needs its own captured migration (see the `-- Capture schema drift: ...`
   files in `supabase/migrations/` for the pattern) before you regenerate
   this file from it.
4. Preserve `security_invoker = true`/`= on` on any view that has it — it's
   load-bearing for RLS (see the comment in
   `supabase/migrations/20260829150000_capture_group_activity_feed.sql`).

## `db/schema.sql` — retired

Superseded by the two sources above. Kept only as a pointer (see the file)
so old links/instructions don't 404. Do not run it, do not add to it.

## `db/migrations/`

Historical. A parallel, ad hoc migration track that was never actually wired
into any runner (nothing applied these automatically — the same is true of
`supabase/migrations/`; both were applied by hand). Its unique content —
`get_recommendation_candidates()` (all five live overloads),
`refresh_fuzzy_event_duplicate_clusters()`, the `is_member` anon-execute
revoke, and the "add events" policy — was verified against the live database
and re-captured into
`supabase/migrations/20260829160000_capture_recommendation_candidates_and_dedup.sql`
on 2026-08-29. `poppy_recommendation_candidates`, the other view this
directory touched, was already superseded by a later, more complete version
in `supabase/migrations/20260827195000_poppy_honest_unified_candidate_model.sql`.
This directory is frozen — no new files, nothing here is applied to
anything — kept for historical reference only.

## CI — and the gap it does NOT close

`.github/workflows/schema-drift.yml` builds a fresh Postgres from
`supabase/migrations/` (via the Supabase CLI's local stack) and diffs its
schema against `db/schema-snapshot.sql`, the committed baseline. A mismatch
fails the build — that's what stops this file and the migrations from
silently drifting apart again. If you change `supabase/migrations/`,
regenerate `db/schema-snapshot.sql` (see above) in the same PR.

**This only checks that the repo is internally consistent with itself.** It
never touches the live database, so it cannot catch the drift that actually
bit this project twice: a migration gets committed but never applied to
production. Concretely, on 2026-08-29 two already-committed migrations
(`20260822223500_add_self_service_account_deletion.sql`,
`20260822224000_lock_account_deletion_execute.sql`) said `delete_my_account`
should be executable by `authenticated` — CI was green the whole time,
because CI never checked production, and production only had `service_role`.
Self-service account deletion was broken for every real user until this was
caught by hand and fixed live (see
`supabase/migrations/20260829180000_reconcile_function_privileges.sql`).

Closing that gap for real means a check that runs against the live database
(schema **and** `pg_proc.proacl`/`aclexplode` for every function) and
compares it to what replaying `supabase/migrations/` in order produces. That
needs read access to the production database from wherever the check runs.
This repo doesn't have that wired up — doing it from GitHub Actions would
mean putting a production Supabase credential in the repo's CI secrets,
which is a call for whoever owns this project to make, not something to add
unilaterally. Until that's set up, the practical mitigation is what caught
this: periodically audit live against `supabase/migrations/` by hand (or via
a Claude Code session with Supabase MCP access, as this one did) — dump
`pg_proc.proacl` and the schema, compare against the committed baseline,
fix forward with a new migration for anything that's drifted.
