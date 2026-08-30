-- Reconcile function privileges: repo intent vs live reality.
--
-- Verified live 2026-08-29 (via pg_proc.proacl / aclexplode, not assumed):
-- committed migrations and the live database had drifted in BOTH
-- directions on who can execute what.
--
-- 1. delete_my_account(): two committed migrations
--    (20260822223500_add_self_service_account_deletion.sql,
--    20260822224000_lock_account_deletion_execute.sql) already say to
--    grant execute to authenticated. Live only had service_role. Since
--    src/app/account/delete/actions.ts calls this RPC from a normal user
--    session (not service_role), self-service account deletion has been
--    broken in production — every real call would fail with a permission
--    error. This was committed-but-never-applied drift, not a new design
--    decision; restoring it.
--
-- 2. propose_event_for_group(): had anon execute live, with no matching
--    revoke ever committed. The function itself immediately raises
--    "authentication required" when auth.uid() is null (verified by
--    reading its body), so anon could never do anything with it — but
--    there's no reason to leave it directly RPC-callable by anon.
--
-- 3. ~22 internal helper functions (trigger functions, and plain
--    functions reachable only from SECURITY INVOKER trigger chains or
--    from views like feed_events) still carried Postgres's default PUBLIC
--    execute grant from whenever they were created, instead of the
--    explicit-role pattern the rest of this schema uses. Verified none of
--    them are called directly by app code (no matching supabase.rpc(...)
--    call site) and that authenticated keeps whatever access it actually
--    needs (e.g. recurrence_occurrence_matches, needed by the
--    security_invoker feed_events view; canonicalize_venue ->
--    clean_venue_text and the other invoker-context trigger functions,
--    reachable from authenticated inserts/updates on events) — only the
--    anon/public surface shrinks, nothing user-facing changes.
--
--    Also caught in the process: this session's own
--    20260829170000_add_search_places_function.sql has the same class of
--    bug — `revoke execute ... from anon` does NOT remove Postgres's
--    default PUBLIC grant (a REVOKE against a named role only removes
--    that role's own explicit entry; it never overrides a PUBLIC grant,
--    since Postgres ACLs have no "deny" that beats PUBLIC). search_places
--    was therefore still anon-callable in production despite that
--    migration's stated intent. `revoke all ... from public` is the
--    correct statement; fixed forward here rather than editing the
--    already-pushed migration.

grant execute on function public.delete_my_account() to authenticated;

revoke execute on function public.propose_event_for_group(uuid, uuid, timestamptz) from anon;

revoke all on function public.search_places(text, text[], integer) from public;

revoke all on function public.candidate_identity_key(text, timestamptz, text) from public;
grant execute on function public.candidate_identity_key(text, timestamptz, text) to authenticated;

revoke all on function public.canonicalize_venue() from public;
grant execute on function public.canonicalize_venue() to authenticated;

revoke all on function public.classify_event_content_type() from public;
grant execute on function public.classify_event_content_type() to authenticated;

revoke all on function public.clean_venue_text(text) from public;
revoke execute on function public.clean_venue_text(text) from anon;
grant execute on function public.clean_venue_text(text) to authenticated;

revoke all on function public.discover_places(uuid, text, text, numeric, integer) from public;
revoke execute on function public.discover_places(uuid, text, text, numeric, integer) from anon;
grant execute on function public.discover_places(uuid, text, text, numeric, integer) to authenticated;

revoke all on function public.distance_km(double precision, double precision, double precision, double precision) from public;
revoke execute on function public.distance_km(double precision, double precision, double precision, double precision) from anon;
grant execute on function public.distance_km(double precision, double precision, double precision, double precision) to authenticated;

revoke all on function public.enforce_crawler_next_crawl() from public;
grant execute on function public.enforce_crawler_next_crawl() to authenticated;

revoke all on function public.enforce_event_freshness_publish_guard() from public;
grant execute on function public.enforce_event_freshness_publish_guard() to authenticated;

revoke all on function public.event_local_hour(timestamptz) from public;
revoke execute on function public.event_local_hour(timestamptz) from anon;
grant execute on function public.event_local_hour(timestamptz) to authenticated;

revoke all on function public.guard_recurring_event_occurrence() from public;
revoke execute on function public.guard_recurring_event_occurrence() from anon;
grant execute on function public.guard_recurring_event_occurrence() to authenticated;

revoke all on function public.guard_source_verification() from public;
revoke execute on function public.guard_source_verification() from anon;
grant execute on function public.guard_source_verification() to authenticated;

revoke execute on function public.infer_event_is_outdoor(uuid, text, text, text) from anon;

revoke all on function public.is_event_outdoor(text, text, text) from public;
revoke execute on function public.is_event_outdoor(text, text, text) from anon;
grant execute on function public.is_event_outdoor(text, text, text) to authenticated;

revoke all on function public.is_kid_relevant_event(text, text, text) from public;
grant execute on function public.is_kid_relevant_event(text, text, text) to authenticated;

revoke all on function public.normalize_dedup_key(text, text, date) from public;
grant execute on function public.normalize_dedup_key(text, text, date) to authenticated;

revoke all on function public.normalize_event_key(text, timestamptz, text) from public;
grant execute on function public.normalize_event_key(text, timestamptz, text) to authenticated;

revoke all on function public.normalize_event_text(text) from public;
revoke execute on function public.normalize_event_text(text) from anon;
grant execute on function public.normalize_event_text(text) to authenticated;

revoke all on function public.normalize_event_text_fields() from public;
revoke execute on function public.normalize_event_text_fields() from anon;
grant execute on function public.normalize_event_text_fields() to authenticated;

revoke all on function public.normalize_for_evidence(text) from public;
revoke execute on function public.normalize_for_evidence(text) from anon;
grant execute on function public.normalize_for_evidence(text) to authenticated;

revoke all on function public.parse_activity_intent(text, integer) from public;
revoke execute on function public.parse_activity_intent(text, integer) from anon;
grant execute on function public.parse_activity_intent(text, integer) to authenticated;

revoke all on function public.place_evidence_supported(text, text) from public;
revoke execute on function public.place_evidence_supported(text, text) from anon;
grant execute on function public.place_evidence_supported(text, text) to authenticated;

revoke all on function public.recurrence_occurrence_matches(timestamptz, text) from public;
revoke execute on function public.recurrence_occurrence_matches(timestamptz, text) from anon;
grant execute on function public.recurrence_occurrence_matches(timestamptz, text) to authenticated;

revoke all on function public.set_candidate_idempotency_key() from public;
grant execute on function public.set_candidate_idempotency_key() to authenticated;
