-- P0 fix: apply_place_toddler_gate, get_places_for_toddler_gate,
-- place_hard_reject_reason, place_category_coverage_report, and
-- place_discovery_duplicate_exists were all still carrying Postgres's
-- default PUBLIC execute grant plus explicit anon/authenticated grants
-- (verified live 2026-08-30 via pg_proc.proacl, not assumed) -- none of
-- the migrations that created them revoked it. The prior toddler-gate
-- migrations forgot the same step 20260829180000 already exists to fix
-- for ~22 other functions.
--
-- apply_place_toddler_gate is the serious one: it is SECURITY DEFINER
-- and, as written, was directly callable by anon over
-- /rest/v1/rpc/apply_place_toddler_gate with attacker-controlled verdict/
-- verdict_quote/reasoning/model. Its evidence check only confirms the
-- quote is a literal substring of the place's own description -- it
-- doesn't confirm the quote actually supports the claimed verdict, so
-- any 8+ char substring of a real description could be replayed to force
-- a place to 'verified' (or 'rejected'). That is exactly the
-- bulk/fabricated-verification anti-pattern this whole feature exists to
-- prevent, except reachable by anyone on the internet rather than by a
-- careless engineer. None of these functions are meant to be called by
-- app code at all -- they're internal to the verify-toddler-fit and
-- discover-places-osm edge functions, which use the service_role key.
revoke all on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text) from public;
revoke execute on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text) from anon;
revoke execute on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text) from authenticated;
grant execute on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text) to service_role;

revoke all on function public.get_places_for_toddler_gate(integer) from public;
revoke execute on function public.get_places_for_toddler_gate(integer) from anon;
revoke execute on function public.get_places_for_toddler_gate(integer) from authenticated;
grant execute on function public.get_places_for_toddler_gate(integer) to service_role;

revoke all on function public.place_hard_reject_reason(text, text, text[]) from public;
revoke execute on function public.place_hard_reject_reason(text, text, text[]) from anon;
revoke execute on function public.place_hard_reject_reason(text, text, text[]) from authenticated;
grant execute on function public.place_hard_reject_reason(text, text, text[]) to service_role;

revoke all on function public.place_category_coverage_report() from public;
revoke execute on function public.place_category_coverage_report() from anon;
grant execute on function public.place_category_coverage_report() to service_role;
grant execute on function public.place_category_coverage_report() to authenticated;

revoke all on function public.place_discovery_duplicate_exists(double precision, double precision) from public;
revoke execute on function public.place_discovery_duplicate_exists(double precision, double precision) from anon;
revoke execute on function public.place_discovery_duplicate_exists(double precision, double precision) from authenticated;
grant execute on function public.place_discovery_duplicate_exists(double precision, double precision) to service_role;
