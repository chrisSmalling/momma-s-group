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
-- Current live events definition includes: content_status, age_band,
-- geography_tier, experience_type, weather_fit, location coordinates,
-- source/review metadata, classification and verification scores,
-- recurrence/discovery metadata, venue display fields and lifecycle flags.

-- ---------- Live venue canonicalization ----------------------
create table if not exists public.venue_aliases (pattern text primary key, canonical text not null);

-- ---------- Live group proposal notifications -----------------
create table if not exists public.group_proposal_notifications (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        not null references public.events(id) on delete cascade,
  group_id     uuid        not null references public.groups(id) on delete cascade,
  recipient_id uuid        not null references auth.users(id)    on delete cascade,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  unique (event_id, recipient_id)
);
-- RLS: recipient can select/update only their own rows. No client INSERT
-- policy — rows are written only by propose_event_for_group() below. Full
-- definition: supabase/migrations/20260829140000_capture_group_proposal_notifications.sql.

-- ---------- Live RLS facts -----------------------------------
-- Operational/discovery tables with RLS and no client policies are intentionally
-- service-role-only. Parent-facing code uses feed_events rather than events.

-- ---------- Live application function signatures -------------
-- public.is_member(g uuid) -> boolean
-- public.distance_km(lat1 double precision, lng1 double precision,
--   lat2 double precision, lng2 double precision) -> double precision
-- public.event_local_hour(ts timestamptz) -> numeric
-- public.refresh_phase2_quality_feedback() -> jsonb
-- public.update_source_reliability(p_source_id uuid, p_outcome text) -> void
-- public.record_recommendation_execution(uuid,text,text,jsonb,integer,uuid[],text) -> uuid
-- authenticated role has EXECUTE on record_recommendation_execution; function
-- is SECURITY DEFINER and enforces auth.uid() = p_user_id.
-- public.propose_event_for_group(p_place_id uuid, p_group_id uuid, p_starts_at timestamptz) -> uuid
-- SECURITY DEFINER; authorizes on group creator or membership; inserts the
-- proposed event, auto-RSVPs the proposer as 'going', and fans out one row
-- per OTHER group member into group_proposal_notifications.
-- (Other application signatures remain defined by their migrations.)

-- ---------- Live indexes of particular ingestion importance --
create unique index if not exists uniq_events_source_external
  on public.events(source, external_id) where external_id is not null;
create index if not exists events_source_external_idx
  on public.events(source_id, external_id)
  where source_id is not null and external_id is not null;
create index if not exists idx_events_duplicate_of on public.events(duplicate_of);
create index if not exists idx_events_kid_relevant
  on public.events(is_kid_relevant, starts_at) where is_kid_relevant;
create index if not exists content_sources_community_rotation_idx
  on public.content_sources(active, discovery_channel, last_attempted_at,
                            community_batch_rank, source_priority desc);

-- ---------- Feedback additions -------------------------------
-- Post-activity sentiment: loved | good | not_for_us.
alter table public.outing_feedback add column if not exists sentiment text;

-- ---------- Live cron jobs -----------------------------------
-- job 1: materialize-programs-nightly       10 7 * * *
-- job 4: mommas-content-sync-hourly           0 * * * *
-- job 6: mommas-event-discovery-daily        15 7 * * *
-- job 7: mommas-event-pipeline-maintenance   30 7 * * *
-- job 10: mommas-community-signals-daily      0 12 * * *
-- job 11: mommas-phase2-dedup-hourly         40 * * * *
-- job 12: mommas-phase2-quality-feedback     45 7 * * *
-- job 14: refresh-event-suppression-hourly   25 * * * *

-- ---------- Live extensions ----------------------------------
-- pg_cron 1.6.4
-- pg_net 0.20.4
-- pg_stat_statements 1.11
-- pg_trgm 1.6 (schema: extensions)
-- pgcrypto 1.3
-- plpgsql 1.0
-- supabase_vault 0.3.1
-- uuid-ossp 1.1

-- ============================================================
-- Historical migration-era schema follows below.
-- ============================================================

