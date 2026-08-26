-- ============================================================
-- Momma's Meetup — LIVE SCHEMA SNAPSHOT OVERRIDES
-- Generated from the live Supabase project on 2026-08-20.
--
-- IMPORTANT: This file supersedes the older schema.sql definitions wherever
-- this live section differs. The original migration-era schema is retained
-- below for historical context. Do NOT treat the historical sections as
-- authoritative for objects listed here.
--
-- Canonical live read model: public.feed_events.
-- Parent-facing event filtering MUST use that view, not events directly.
-- ============================================================

-- ---------- Live feed_events view ----------------------------

create or replace view public.feed_events as
select id,
  coalesce(display_title, title) as title,
  description,
  coalesce(venue_display, organizer, venue_name) as venue,
  room_name,
  organizer,
  address,
  coalesce(lat, location_latitude) as lat,
  coalesce(lng, location_longitude) as lng,
  location_latitude,
  location_longitude,
  starts_at,
  ends_at,
  time_precision,
  time_precision = 'date_only' as time_unknown,
  cost,
  cost is null as is_free,
  age_tags,
  age_min_months,
  age_max_months,
  age_band,
  is_outdoor,
  what_to_bring,
  registration_required,
  registration_url,
  source,
  source_id,
  source_url,
  added_by,
  content_status,
  geography_tier,
  experience_type,
  weather_fit,
  today_priority,
  discovery_priority,
  feed_score,
  classification_confidence,
  recurring_score,
  one_time_score,
  recurrence_pattern,
  verification_score,
  verification_tier,
  verification_reasons,
  content_verified_at,
  place_id,
  program_id,
  proposed_by_group,
  metro_area,
  status,
  last_verified_at
from public.events e
where status = 'published'
  and is_kid_relevant
  and not is_suppressed
  and duplicate_of is null;

-- ---------- Live events columns ------------------------------

-- Current live events definition includes, in addition to the historical
-- schema: content_status, age_band, geography_tier, experience_type,
-- weather_fit, today_priority, location_latitude/location_longitude,
-- location_city/state/zip, source_id, content_review_status,
-- content_review_reason, content_verified_at, source_last_seen_at,
-- event_time_known, time_normalization_note, classification_confidence,
-- recurrence_pattern, discovery_priority, classification_reason,
-- verification_tier/score/reasons, one_time_score, recurring_score,
-- feed_score/reasons, duplicate_of_event_id, time_precision, duplicate_of,
-- is_suppressed, suppressed_reason, organizer, venue_display, room_name,
-- display_title.

-- Current live events constraints:
--   status: published | cancelled
--   content_status: keep | review | exclude
--   age_band: baby | toddler | preschool | family_0_5 | review | exclude
--   geography_tier: pasco | tampa | far | unknown
--   time_precision: exact | date_only
--   verification_tier: trusted | high | medium | low | unverified
--   classification_confidence/feed_score/one_time_score/recurring_score/
--     verification_score/discovery_priority are bounded 0..100.
--   source_id -> content_sources(id) ON DELETE SET NULL
--   metro_area -> markets(id)
--   duplicate_of -> events(id) ON DELETE SET NULL
--   duplicate_of_event_id -> events(id)
--   place_id -> places(id) ON DELETE SET NULL
--   program_id -> recurring_programs(id) ON DELETE SET NULL
--   proposed_by_group -> groups(id) ON DELETE CASCADE
--   added_by -> auth.users(id)
--
-- Live content_sources.source_type constraint is:
--   ical | api | structured_web | manual | discovery
--
-- Live community_event_signals.status constraint is:
--   needs_review | low_confidence | accepted | rejected | expired

-- ---------- Live venue canonicalization ----------------------

create table if not exists public.venue_aliases (
  pattern text primary key,
  canonical text not null
);

-- Live trigger (definition owned by the database):
--   events INSERT/UPDATE -> canonicalize_venue()
-- The trigger auto-fills venue_display, room_name, and display_title.
-- Ingestion MUST NOT set those display fields.

-- ---------- Live RLS facts -----------------------------------

-- RLS is enabled on all operational/discovery tables. These discovery tables
-- intentionally have ZERO client policies and are therefore service-role-only:
-- activity_source_records, activity_sources, community_event_signals,
-- community_signal_run_audit, content_sources, content_sync_runs,
-- discovery_queries, discovery_runs, event_discovery_candidates,
-- event_duplicate_clusters, known_organizers, organizer_candidates,
-- organizer_source_links.
-- venue_aliases is not RLS-enabled.
--
-- IMPORTANT live asymmetry: the legacy events SELECT policy still contains
-- content_status='keep'. Parent-facing code MUST use feed_events instead,
-- whose authoritative filter is status='published' AND is_kid_relevant AND
-- NOT is_suppressed AND duplicate_of IS NULL.

-- ---------- Live application function signatures -------------

-- public.add_organizer_source(p_organizer_id uuid, p_source_url text,
--   p_source_kind text, p_priority integer) -> uuid
-- public.apply_local_event_quality_rules() -> trigger
-- public.apply_organizer_feedback() -> trigger
-- public.auto_approve_discovery_candidates() -> integer
-- public.cancel_event(target_event uuid, reason text) -> table
-- public.canonicalize_venue() -> trigger
-- public.classify_event_content_type() -> trigger
-- public.distance_km(lat1 double precision, lng1 double precision,
--   lat2 double precision, lng2 double precision) -> double precision
-- public.event_local_hour(ts timestamptz) -> numeric
-- public.handle_new_user() -> trigger
-- public.is_kid_relevant_event(p_title text, p_venue_name text,
--   p_source text) -> boolean
-- public.is_member(g uuid) -> boolean
-- public.join_group_by_code(code text) -> uuid
-- public.maintain_event_pipeline() -> jsonb
-- public.materialize_programs(days_ahead integer) -> integer
-- public.merge_safe_event_duplicates() -> jsonb
-- public.normalize_dedup_key(title text, venue text, event_date date) -> text
-- public.normalize_event_key(p_title text, p_starts_at timestamptz,
--   p_venue text) -> text
-- public.promote_comment_to_tip(comment_id uuid, tip_category text) -> uuid
-- public.recompute_feed_scores() -> integer
-- public.refresh_event_duplicate_clusters() -> integer
-- public.refresh_event_suppression() -> integer
-- public.refresh_fuzzy_event_duplicate_clusters() -> integer
-- public.refresh_phase2_quality_feedback() -> jsonb
-- public.score_organizer_candidate(p_id uuid) -> void
-- public.shares_group_with(target uuid) -> boolean
-- public.update_source_reliability(p_source_id uuid, p_outcome text) -> void
-- public.upsert_organizer_candidate(p_name text, p_category text,
--   p_locality text, p_website_url text, p_discovery_url text,
--   p_method text, p_confidence numeric, p_relevance integer) -> uuid
-- public.validate_community_cron_secret(provided_secret text) -> boolean
-- public.validate_cron_secret(candidate text) -> boolean
-- public.who_is_free(target_group uuid, days_ahead integer) ->
--   table(window_start timestamptz, window_end timestamptz,
--         also_free text[], matching_events jsonb)

-- ---------- Live indexes of particular ingestion importance --

create unique index if not exists uniq_events_source_external
  on public.events(source, external_id) where external_id is not null;
create index if not exists events_source_external_idx
  on public.events(source_id, external_id)
  where source_id is not null and external_id is not null;
create index if not exists idx_events_duplicate_of
  on public.events(duplicate_of);
create index if not exists idx_events_kid_relevant
  on public.events(is_kid_relevant, starts_at) where is_kid_relevant;
create index if not exists content_sources_community_rotation_idx
  on public.content_sources(active, discovery_channel, last_attempted_at,
                            community_batch_rank, source_priority desc);

-- ---------- Feedback additions -------------------------------

-- Post-activity sentiment is intentionally nullable for backwards compatibility.
-- Values: loved | good | not_for_us.
alter table public.outing_feedback
  add column if not exists sentiment text;

-- ---------- Live cron jobs -----------------------------------

-- job 1: materialize-programs-nightly       10 7 * * *
-- job 4: mommas-content-sync-hourly           0 * * * *
-- job 6: mommas-event-discovery-daily        15 7 * * *
-- job 7: mommas-event-pipeline-maintenance   30 7 * * *
-- job 10: mommas-community-signals-daily      0 12 * * *
-- job 11: mommas-phase2-dedup-hourly         40 * * * *
-- job 12: mommas-phase2-quality-feedback     45 7 * * *
-- job 14: refresh-event-suppression-hourly   25 * * * *
--
-- Dedup is currently performed by both jobs 11 and 14; consolidation remains
-- queued and is deliberately NOT done in this snapshot change.

-- ---------- Live extensions ----------------------------------
-- pg_cron 1.6.4
-- pg_net 0.20.4
-- pg_stat_statements 1.11
-- pg_trgm 1.6 (schema: extensions — moved out of public 2026-08-25, unused by app code)
-- pgcrypto 1.3
-- plpgsql 1.0
-- supabase_vault 0.3.1
-- uuid-ossp 1.1

-- ============================================================
-- Historical migration-era schema follows below.
-- ============================================================

