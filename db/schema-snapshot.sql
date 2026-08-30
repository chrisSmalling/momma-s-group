-- GENERATED FILE. DO NOT HAND-EDIT.
-- Generated from a live dump of the production Supabase database (project uiuibwufzhirpntdtqpj)
-- on 2026-08-29, cross-checked against supabase/migrations/. Regenerate via the same process
-- (see db/README.md) whenever supabase/migrations/ changes; never edit this file by hand.
--
-- Paste this into a fresh Supabase project's SQL editor to bootstrap a schema matching production.

-- Extensions
create extension if not exists "pg_cron" with schema "pg_catalog";
create extension if not exists "pg_net" with schema "extensions";
create extension if not exists "pg_stat_statements" with schema "extensions";
create extension if not exists "pg_trgm" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "supabase_vault" with schema "vault";
create extension if not exists "uuid-ossp" with schema "extensions";

-- Enum types
create type public.recommendation_intent as enum ('discover', 'plan', 'coordinate', 'reflect');

-- Tables
create table public."activity_source_records" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "source_id" uuid NOT NULL,
  "external_id" text NOT NULL,
  "external_url" text,
  "raw_payload" jsonb,
  "dedup_key" text NOT NULL,
  "resolved_event_id" uuid,
  "resolved_place_id" uuid,
  "resolved_program_id" uuid,
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "verification_status" text NOT NULL DEFAULT 'needs_review'::text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."activity_sources" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "source_type" text NOT NULL,
  "base_url" text,
  "metro_area" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "fetch_frequency_minutes" integer,
  "last_fetch_at" timestamptz,
  "last_fetch_status" text,
  "last_fetch_error" text,
  "last_success_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "feed_format" text
);

create table public."availability" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."community_event_signals" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizer_id" uuid,
  "source_url" text,
  "source_name" text NOT NULL,
  "signal_text" text NOT NULL,
  "discovered_at" timestamptz NOT NULL DEFAULT now(),
  "event_date" timestamptz,
  "event_title" text,
  "location_text" text,
  "status" text NOT NULL DEFAULT 'needs_review'::text,
  "confidence" numeric(5,4) NOT NULL DEFAULT 0,
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."community_signal_run_audit" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "function_name" text NOT NULL,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "sources_attempted" integer NOT NULL DEFAULT 0,
  "sources_succeeded" integer NOT NULL DEFAULT 0,
  "signals_found" integer NOT NULL DEFAULT 0,
  "signals_saved" integer NOT NULL DEFAULT 0,
  "sources_added" integer NOT NULL DEFAULT 0,
  "errors" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'running'::text,
  "error_message" text
);

create table public."content_sources" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "source_type" text NOT NULL,
  "source_url" text,
  "active" boolean NOT NULL DEFAULT true,
  "refresh_interval_minutes" integer NOT NULL DEFAULT 1440,
  "last_attempted_at" timestamptz,
  "last_success_at" timestamptz,
  "last_error" text,
  "last_event_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "organizer_id" uuid,
  "source_category" text NOT NULL DEFAULT 'calendar'::text,
  "discovery_priority" integer NOT NULL DEFAULT 50,
  "discovery_channel" text NOT NULL DEFAULT 'calendar'::text,
  "source_priority" integer NOT NULL DEFAULT 50,
  "reliability_score" integer NOT NULL DEFAULT 50,
  "discovery_count" integer NOT NULL DEFAULT 0,
  "successful_event_count" integer NOT NULL DEFAULT 0,
  "rejected_event_count" integer NOT NULL DEFAULT 0,
  "last_quality_update_at" timestamptz,
  "community_batch_rank" integer NOT NULL DEFAULT 0,
  "next_crawl_at" timestamptz,
  "consecutive_failures" integer NOT NULL DEFAULT 0,
  "consecutive_zero_yield" integer NOT NULL DEFAULT 0,
  "last_http_status" integer,
  "last_crawl_duration_ms" integer
);

create table public."content_sync_runs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "source_id" uuid,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "status" text NOT NULL DEFAULT 'running'::text,
  "discovered_count" integer NOT NULL DEFAULT 0,
  "created_count" integer NOT NULL DEFAULT 0,
  "updated_count" integer NOT NULL DEFAULT 0,
  "rejected_count" integer NOT NULL DEFAULT 0,
  "error_message" text
);

create table public."discovery_queries" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "query" text NOT NULL,
  "category" text NOT NULL,
  "locality" text NOT NULL,
  "priority" integer NOT NULL DEFAULT 50,
  "active" boolean NOT NULL DEFAULT true,
  "last_run_at" timestamptz,
  "last_result_count" integer NOT NULL DEFAULT 0
);

create table public."discovery_runs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "query_id" uuid,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "status" text NOT NULL DEFAULT 'running'::text,
  "candidates_found" integer NOT NULL DEFAULT 0,
  "sources_added" integer NOT NULL DEFAULT 0,
  "events_found" integer NOT NULL DEFAULT 0,
  "error_message" text
);

create table public."event_candidate_quality" (
  "candidate_id" uuid NOT NULL,
  "source_trust" numeric NOT NULL DEFAULT 50,
  "source_sample_confidence" numeric NOT NULL DEFAULT 0,
  "family_relevance" numeric NOT NULL DEFAULT 0,
  "age_confidence" numeric NOT NULL DEFAULT 0,
  "time_confidence" numeric NOT NULL DEFAULT 0,
  "location_confidence" numeric NOT NULL DEFAULT 0,
  "freshness" numeric NOT NULL DEFAULT 0,
  "duplicate_confidence" numeric NOT NULL DEFAULT 0,
  "completeness" numeric NOT NULL DEFAULT 0,
  "quality_score" numeric NOT NULL DEFAULT 0,
  "hard_veto" boolean NOT NULL DEFAULT false,
  "hard_veto_reason" text,
  "decision" text NOT NULL DEFAULT 'hold'::text,
  "evaluated_at" timestamptz NOT NULL DEFAULT now()
);

create table public."event_comments" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "promoted_tip_id" uuid,
  "edited_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."event_discovery_candidates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "source_id" uuid,
  "external_id" text,
  "title" text NOT NULL,
  "description" text,
  "venue_name" text,
  "address" text,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "source_url" text NOT NULL,
  "discovered_at" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'needs_review'::text,
  "confidence" numeric(4,3),
  "reason" text,
  "score" integer NOT NULL DEFAULT 0,
  "age_band" text,
  "geography_tier" text,
  "organizer_id" uuid,
  "auto_approved" boolean NOT NULL DEFAULT false,
  "canonical_key" text,
  "content_type" text NOT NULL DEFAULT 'event'::text,
  "content_type_confidence" numeric(5,4) NOT NULL DEFAULT 0,
  "content_type_reason" text,
  "candidate_status" text NOT NULL DEFAULT 'discovered'::text,
  "community_signal_id" uuid,
  "promotion_event_id" uuid,
  "promotion_attempted_at" timestamptz,
  "promoted_at" timestamptz,
  "promotion_error" text,
  "idempotency_key" text
);

create table public."event_duplicate_clusters" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "cluster_key" text NOT NULL,
  "event_ids" uuid[] NOT NULL,
  "confidence" integer NOT NULL DEFAULT 0,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

create table public."event_freshness_checks" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "checked_at" timestamptz NOT NULL DEFAULT now(),
  "freshness_state" text NOT NULL,
  "source_seen_at" timestamptz,
  "source_status" text,
  "reason" text,
  "next_check_at" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "source_signature" text
);

create table public."event_freshness_state" (
  "event_id" uuid NOT NULL,
  "freshness_state" text NOT NULL DEFAULT 'fresh'::text,
  "last_checked_at" timestamptz,
  "last_source_seen_at" timestamptz,
  "last_source_status" text,
  "next_check_at" timestamptz,
  "stale_since" timestamptz,
  "cancellation_detected_at" timestamptz,
  "completed_at" timestamptz,
  "confidence_decay" numeric(5,2) NOT NULL DEFAULT 0,
  "reason" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "source_signature" text
);

create table public."event_pipeline_alerts" (
  "id" bigint NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz,
  "severity" text NOT NULL,
  "alert_key" text NOT NULL,
  "component" text NOT NULL,
  "message" text NOT NULL,
  "metric_value" numeric,
  "threshold_value" numeric,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
);

create table public."event_pipeline_health_audit_log" (
  "id" bigint NOT NULL,
  "checked_at" timestamptz NOT NULL DEFAULT now(),
  "health" jsonb NOT NULL
);

create table public."event_pipeline_source_health" (
  "id" bigint NOT NULL,
  "checked_at" timestamptz NOT NULL DEFAULT now(),
  "source_id" uuid,
  "source_name" text NOT NULL,
  "active" boolean NOT NULL,
  "refresh_interval_minutes" integer,
  "minutes_since_success" numeric,
  "minutes_since_attempt" numeric,
  "discovery_count" bigint NOT NULL DEFAULT 0,
  "successful_event_count" bigint NOT NULL DEFAULT 0,
  "rejected_event_count" bigint NOT NULL DEFAULT 0,
  "candidate_count" bigint NOT NULL DEFAULT 0,
  "promoted_count" bigint NOT NULL DEFAULT 0,
  "source_error" text,
  "health_status" text NOT NULL,
  "health_reasons" jsonb NOT NULL DEFAULT '[]'::jsonb
);

create table public."event_source_trust" (
  "source_id" uuid NOT NULL,
  "prior_score" numeric NOT NULL DEFAULT 50,
  "observed_events" integer NOT NULL DEFAULT 0,
  "observed_good" integer NOT NULL DEFAULT 0,
  "observed_bad" integer NOT NULL DEFAULT 0,
  "observed_duplicate" integer NOT NULL DEFAULT 0,
  "trust_score" numeric NOT NULL DEFAULT 50,
  "sample_confidence" numeric NOT NULL DEFAULT 0,
  "auto_publish_eligible" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

create table public."events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "description" text,
  "venue_name" text,
  "address" text,
  "lat" double precision,
  "lng" double precision,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz,
  "age_tags" text[] NOT NULL DEFAULT '{}'::text[],
  "cost" text,
  "source" text NOT NULL DEFAULT 'manual'::text,
  "source_url" text,
  "added_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "place_id" uuid,
  "program_id" uuid,
  "metro_area" text NOT NULL DEFAULT 'tampa_bay'::text,
  "external_id" text,
  "status" text NOT NULL DEFAULT 'published'::text,
  "registration_required" boolean NOT NULL DEFAULT false,
  "registration_url" text,
  "age_min_months" integer,
  "age_max_months" integer,
  "proposed_by_group" uuid,
  "last_verified_at" timestamptz,
  "is_outdoor" boolean NOT NULL DEFAULT false,
  "what_to_bring" text[] NOT NULL DEFAULT '{}'::text[],
  "is_kid_relevant" boolean NOT NULL DEFAULT false,
  "content_status" text NOT NULL DEFAULT 'review'::text,
  "age_band" text,
  "geography_tier" text,
  "experience_type" text,
  "weather_fit" text,
  "today_priority" integer DEFAULT 0,
  "location_latitude" double precision,
  "location_longitude" double precision,
  "location_city" text,
  "location_state" text,
  "location_zip" text,
  "source_id" uuid,
  "content_review_status" text NOT NULL DEFAULT 'auto_approved'::text,
  "content_review_reason" text,
  "content_verified_at" timestamptz,
  "source_last_seen_at" timestamptz,
  "event_time_known" boolean NOT NULL DEFAULT true,
  "time_normalization_note" text,
  "classification_confidence" integer NOT NULL DEFAULT 0,
  "recurrence_pattern" text,
  "discovery_priority" integer NOT NULL DEFAULT 50,
  "classification_reason" text,
  "verification_tier" text NOT NULL DEFAULT 'unverified'::text,
  "verification_score" integer NOT NULL DEFAULT 0,
  "verification_reasons" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "one_time_score" integer NOT NULL DEFAULT 0,
  "recurring_score" integer NOT NULL DEFAULT 0,
  "feed_score" integer NOT NULL DEFAULT 0,
  "feed_reasons" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "duplicate_of_event_id" uuid,
  "time_precision" text NOT NULL DEFAULT 'exact'::text,
  "duplicate_of" uuid,
  "is_suppressed" boolean NOT NULL DEFAULT false,
  "suppressed_reason" text,
  "organizer" text,
  "venue_display" text,
  "room_name" text,
  "display_title" text,
  "llm_enriched_at" timestamptz,
  "llm_model" text
);

create table public."group_event_plans" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "group_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "question" text NOT NULL DEFAULT 'Anyone want to do this?'::text,
  "status" text NOT NULL DEFAULT 'open'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

create table public."group_members" (
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "things_to_know" text
);

create table public."group_proposal_notifications" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL,
  "group_id" uuid NOT NULL,
  "recipient_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "read_at" timestamptz
);

create table public."groups" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "invite_code" text NOT NULL DEFAULT encode(gen_random_bytes(5), 'hex'::text),
  "created_by" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."known_organizers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "organizer_type" text NOT NULL DEFAULT 'other'::text,
  "website" text,
  "source_id" uuid,
  "priority" integer NOT NULL DEFAULT 50,
  "reliability_score" numeric(5,2) NOT NULL DEFAULT 50,
  "active" boolean NOT NULL DEFAULT true,
  "last_checked_at" timestamptz,
  "last_good_event_at" timestamptz,
  "good_event_count" integer NOT NULL DEFAULT 0,
  "rejected_event_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

create table public."market_coverage_slo" (
  "id" bigint NOT NULL,
  "market" text NOT NULL,
  "event_day" date NOT NULL,
  "qualified_count" integer NOT NULL DEFAULT 0,
  "indoor_count" integer NOT NULL DEFAULT 0,
  "outdoor_count" integer NOT NULL DEFAULT 0,
  "target_count" integer NOT NULL DEFAULT 5,
  "status" text NOT NULL DEFAULT 'red'::text,
  "evaluated_at" timestamptz NOT NULL DEFAULT now()
);

create table public."markets" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "center_lat" double precision NOT NULL,
  "center_lng" double precision NOT NULL,
  "radius_minutes" integer NOT NULL DEFAULT 45,
  "timezone" text NOT NULL DEFAULT 'America/New_York'::text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."organizer_candidates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "category" text NOT NULL,
  "locality" text,
  "website_url" text,
  "discovery_url" text,
  "discovery_method" text NOT NULL DEFAULT 'search'::text,
  "confidence" numeric(4,3) NOT NULL DEFAULT 0.5,
  "relevance_score" integer NOT NULL DEFAULT 50,
  "status" text NOT NULL DEFAULT 'candidate'::text,
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "last_classified_at" timestamptz,
  "classification_reason" text,
  "verification_score" integer NOT NULL DEFAULT 0,
  "source_count" integer NOT NULL DEFAULT 0,
  "last_verified_at" timestamptz,
  "quality_tier" text NOT NULL DEFAULT 'unverified'::text
);

create table public."organizer_source_links" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizer_id" uuid NOT NULL,
  "source_url" text NOT NULL,
  "source_kind" text NOT NULL,
  "accessible" boolean NOT NULL DEFAULT true,
  "priority" integer NOT NULL DEFAULT 50,
  "last_checked_at" timestamptz,
  "last_success_at" timestamptz,
  "consecutive_successes" integer NOT NULL DEFAULT 0,
  "consecutive_failures" integer NOT NULL DEFAULT 0,
  "quality_score" integer NOT NULL DEFAULT 50,
  "event_yield" integer NOT NULL DEFAULT 0,
  "relevant_event_yield" integer NOT NULL DEFAULT 0,
  "last_relevant_event_at" timestamptz
);

create table public."outing_feedback" (
  "event_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "would_repeat" boolean NOT NULL,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "sentiment" text
);

create table public."place_exposure" (
  "user_id" uuid NOT NULL,
  "place_id" uuid NOT NULL,
  "last_shown_at" date NOT NULL,
  "consecutive_days" integer NOT NULL DEFAULT 1
);

create table public."place_geocode_backfill" (
  "request_id" bigint NOT NULL,
  "place_id" uuid NOT NULL,
  "requested_at" timestamptz NOT NULL DEFAULT now()
);

create table public."place_revalidation_runs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "queue_pulled" integer NOT NULL DEFAULT 0,
  "enriched" integer NOT NULL DEFAULT 0,
  "verified" integer NOT NULL DEFAULT 0,
  "needs_review" integer NOT NULL DEFAULT 0,
  "gemini_failed_batches" integer NOT NULL DEFAULT 0,
  "missing_verdicts" integer NOT NULL DEFAULT 0,
  "write_failures" integer NOT NULL DEFAULT 0,
  "error" text
);

create table public."place_tips" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "place_id" uuid,
  "event_id" uuid,
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general'::text,
  "helpful_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."places" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "address" text,
  "lat" double precision,
  "lng" double precision,
  "metro_area" text NOT NULL DEFAULT 'tampa_bay'::text,
  "hours" jsonb,
  "description" text,
  "toddler_notes" text,
  "price_note" text,
  "age_min_months" integer,
  "age_max_months" integer,
  "website" text,
  "booking_url" text,
  "phone" text,
  "source_url" text,
  "last_verified_at" timestamptz,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "is_enclosed" boolean,
  "is_outdoor" boolean NOT NULL DEFAULT false,
  "has_changing_table" boolean,
  "nursing_friendly" boolean,
  "stroller_accessible" boolean,
  "food_allowed" boolean,
  "food_onsite" boolean,
  "restrooms" boolean,
  "parking_notes" text,
  "what_to_bring" text[] NOT NULL DEFAULT '{}'::text[],
  "quiet_or_sensory_friendly" boolean,
  "typical_crowd_note" text,
  "best_time_note" text,
  "latitude" double precision,
  "longitude" double precision,
  "city" text,
  "state" text,
  "zip_code" text,
  "place_type" text,
  "category_tags" text[] NOT NULL DEFAULT '{}'::text[],
  "discovery_priority" integer NOT NULL DEFAULT 50,
  "public_access" boolean NOT NULL DEFAULT true,
  "llm_enriched_at" timestamptz,
  "llm_model" text,
  "llm_verification_status" text NOT NULL DEFAULT 'unverified'::text,
  "llm_verified_at" timestamptz,
  "llm_enrichment_evidence" jsonb,
  "llm_enrichment_provenance" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "facility_data_source" text NOT NULL DEFAULT 'unknown'::text,
  "legacy_facility_snapshot" jsonb,
  "llm_last_revalidation" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "season_start" date,
  "season_end" date
);

create table public."profiles" (
  "id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "avatar_color" text NOT NULL DEFAULT '#C0356E'::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "nap_start" time,
  "nap_end" time,
  "child_age_months" integer,
  "home_lat" double precision,
  "home_lng" double precision,
  "home_address" text,
  "home_street" text,
  "home_city" text,
  "home_state" text,
  "home_zip" text,
  "max_distance_miles" numeric(4,1) NOT NULL DEFAULT 45,
  "preferred_categories" text[] NOT NULL DEFAULT '{}'::text[],
  "preferred_place_types" text[] NOT NULL DEFAULT '{}'::text[],
  "indoor_preference" text NOT NULL DEFAULT 'any'::text,
  "discovery_view" text NOT NULL DEFAULT 'smart'::text,
  "child_name" text,
  "child_interests" text[] NOT NULL DEFAULT '{}'::text[],
  "child_activity_preferences" text[] NOT NULL DEFAULT '{}'::text[],
  "family_budget_note" text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "onboarding_completed_at" timestamptz
);

create table public."recommendation_audit" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "request_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "candidate_kind" text NOT NULL,
  "candidate_id" uuid NOT NULL,
  "hard_filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "score" numeric,
  "explanation" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "passed_hard_filters" boolean NOT NULL DEFAULT false,
  "filter_reasons" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "source_kind" text,
  "source_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb
);

create table public."recommendation_feedback" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "request_id" uuid NOT NULL,
  "candidate_id" uuid NOT NULL,
  "feedback" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."recommendation_requests" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "user_id" uuid,
  "raw_prompt" text NOT NULL,
  "intent" recommendation_intent,
  "constraints" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "candidate_count" integer NOT NULL DEFAULT 0,
  "selected_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[],
  "model" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."recommendation_response_cache" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "request_hash" text NOT NULL,
  "user_id" uuid,
  "request_id" uuid,
  "response" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "model" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL DEFAULT (now() + '00:15:00'::interval)
);

create table public."recurring_programs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "place_id" uuid,
  "venue_name" text,
  "address" text,
  "metro_area" text NOT NULL DEFAULT 'tampa_bay'::text,
  "title" text NOT NULL,
  "description" text,
  "rrule" text NOT NULL,
  "start_time" time NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 30,
  "age_min_months" integer,
  "age_max_months" integer,
  "age_label" text,
  "cost" text,
  "registration_required" boolean NOT NULL DEFAULT false,
  "registration_url" text,
  "season_start" date,
  "season_end" date,
  "source" text NOT NULL DEFAULT 'manual'::text,
  "source_url" text,
  "last_verified_at" timestamptz,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

create table public."rsvps" (
  "event_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "note" text,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

create table public."venue_aliases" (
  "pattern" text NOT NULL,
  "canonical" text NOT NULL
);

-- Primary keys and unique constraints (create before other constraints/indexes)
alter table public."activity_source_records" add constraint "activity_source_records_pkey" PRIMARY KEY (id);
alter table public."activity_sources" add constraint "activity_sources_pkey" PRIMARY KEY (id);
alter table public."availability" add constraint "availability_pkey" PRIMARY KEY (id);
alter table public."community_event_signals" add constraint "community_event_signals_pkey" PRIMARY KEY (id);
alter table public."community_signal_run_audit" add constraint "community_signal_run_audit_pkey" PRIMARY KEY (id);
alter table public."content_sources" add constraint "content_sources_pkey" PRIMARY KEY (id);
alter table public."content_sync_runs" add constraint "content_sync_runs_pkey" PRIMARY KEY (id);
alter table public."discovery_queries" add constraint "discovery_queries_pkey" PRIMARY KEY (id);
alter table public."discovery_queries" add constraint "discovery_queries_query_key" UNIQUE (query);
alter table public."discovery_runs" add constraint "discovery_runs_pkey" PRIMARY KEY (id);
alter table public."event_candidate_quality" add constraint "event_candidate_quality_pkey" PRIMARY KEY (candidate_id);
alter table public."event_comments" add constraint "event_comments_pkey" PRIMARY KEY (id);
alter table public."event_discovery_candidates" add constraint "event_discovery_candidates_pkey" PRIMARY KEY (id);
alter table public."event_discovery_candidates" add constraint "event_discovery_candidates_source_id_external_id_key" UNIQUE (source_id, external_id);
alter table public."event_duplicate_clusters" add constraint "event_duplicate_clusters_pkey" PRIMARY KEY (id);
alter table public."event_duplicate_clusters" add constraint "event_duplicate_clusters_cluster_key_key" UNIQUE (cluster_key);
alter table public."event_freshness_checks" add constraint "event_freshness_checks_pkey" PRIMARY KEY (id);
alter table public."event_freshness_state" add constraint "event_freshness_state_pkey" PRIMARY KEY (event_id);
alter table public."event_pipeline_alerts" add constraint "event_pipeline_alerts_pkey" PRIMARY KEY (id);
alter table public."event_pipeline_health_audit_log" add constraint "event_pipeline_health_audit_log_pkey" PRIMARY KEY (id);
alter table public."event_pipeline_source_health" add constraint "event_pipeline_source_health_pkey" PRIMARY KEY (id);
alter table public."event_pipeline_source_health" add constraint "event_pipeline_source_health_source_id_checked_at_key" UNIQUE (source_id, checked_at);
alter table public."event_source_trust" add constraint "event_source_trust_pkey" PRIMARY KEY (source_id);
alter table public."events" add constraint "events_pkey" PRIMARY KEY (id);
alter table public."group_event_plans" add constraint "group_event_plans_pkey" PRIMARY KEY (id);
alter table public."group_members" add constraint "group_members_pkey" PRIMARY KEY (group_id, user_id);
alter table public."group_proposal_notifications" add constraint "group_proposal_notifications_pkey" PRIMARY KEY (id);
alter table public."group_proposal_notifications" add constraint "group_proposal_notifications_event_id_recipient_id_key" UNIQUE (event_id, recipient_id);
alter table public."groups" add constraint "groups_pkey" PRIMARY KEY (id);
alter table public."groups" add constraint "groups_invite_code_key" UNIQUE (invite_code);
alter table public."known_organizers" add constraint "known_organizers_pkey" PRIMARY KEY (id);
alter table public."market_coverage_slo" add constraint "market_coverage_slo_pkey" PRIMARY KEY (id);
alter table public."market_coverage_slo" add constraint "market_coverage_slo_market_event_day_key" UNIQUE (market, event_day);
alter table public."markets" add constraint "markets_pkey" PRIMARY KEY (id);
alter table public."organizer_candidates" add constraint "organizer_candidates_pkey" PRIMARY KEY (id);
alter table public."organizer_candidates" add constraint "organizer_candidates_name_category_locality_key" UNIQUE (name, category, locality);
alter table public."organizer_source_links" add constraint "organizer_source_links_pkey" PRIMARY KEY (id);
alter table public."organizer_source_links" add constraint "organizer_source_links_organizer_id_source_url_key" UNIQUE (organizer_id, source_url);
alter table public."outing_feedback" add constraint "outing_feedback_pkey" PRIMARY KEY (event_id, user_id);
alter table public."place_exposure" add constraint "place_exposure_pkey" PRIMARY KEY (user_id, place_id);
alter table public."place_geocode_backfill" add constraint "place_geocode_backfill_pkey" PRIMARY KEY (request_id);
alter table public."place_revalidation_runs" add constraint "place_revalidation_runs_pkey" PRIMARY KEY (id);
alter table public."place_tips" add constraint "place_tips_pkey" PRIMARY KEY (id);
alter table public."places" add constraint "places_pkey" PRIMARY KEY (id);
alter table public."places" add constraint "places_source_url_key" UNIQUE (source_url);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."recommendation_audit" add constraint "recommendation_audit_pkey" PRIMARY KEY (id);
alter table public."recommendation_feedback" add constraint "recommendation_feedback_pkey" PRIMARY KEY (id);
alter table public."recommendation_requests" add constraint "recommendation_requests_pkey" PRIMARY KEY (id);
alter table public."recommendation_response_cache" add constraint "recommendation_response_cache_pkey" PRIMARY KEY (id);
alter table public."recommendation_response_cache" add constraint "recommendation_response_cache_request_hash_key" UNIQUE (request_hash);
alter table public."recurring_programs" add constraint "recurring_programs_pkey" PRIMARY KEY (id);
alter table public."rsvps" add constraint "rsvps_pkey" PRIMARY KEY (event_id, user_id);
alter table public."venue_aliases" add constraint "venue_aliases_pkey" PRIMARY KEY (pattern);

-- Foreign keys
alter table public."activity_source_records" add constraint "activity_source_records_resolved_event_id_fkey" FOREIGN KEY (resolved_event_id) REFERENCES events(id) ON DELETE SET NULL;
alter table public."activity_source_records" add constraint "activity_source_records_resolved_place_id_fkey" FOREIGN KEY (resolved_place_id) REFERENCES places(id) ON DELETE SET NULL;
alter table public."activity_source_records" add constraint "activity_source_records_resolved_program_id_fkey" FOREIGN KEY (resolved_program_id) REFERENCES recurring_programs(id) ON DELETE SET NULL;
alter table public."activity_source_records" add constraint "activity_source_records_source_id_fkey" FOREIGN KEY (source_id) REFERENCES activity_sources(id) ON DELETE CASCADE;
alter table public."activity_sources" add constraint "activity_sources_metro_area_fkey" FOREIGN KEY (metro_area) REFERENCES markets(id);
alter table public."availability" add constraint "availability_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public."availability" add constraint "availability_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."community_event_signals" add constraint "community_event_signals_organizer_id_fkey" FOREIGN KEY (organizer_id) REFERENCES known_organizers(id) ON DELETE SET NULL;
alter table public."content_sources" add constraint "content_sources_organizer_id_fkey" FOREIGN KEY (organizer_id) REFERENCES known_organizers(id) ON DELETE SET NULL;
alter table public."content_sync_runs" add constraint "content_sync_runs_source_id_fkey" FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE;
alter table public."discovery_runs" add constraint "discovery_runs_query_id_fkey" FOREIGN KEY (query_id) REFERENCES discovery_queries(id) ON DELETE SET NULL;
alter table public."event_candidate_quality" add constraint "event_candidate_quality_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES event_discovery_candidates(id) ON DELETE CASCADE;
alter table public."event_comments" add constraint "event_comments_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."event_comments" add constraint "event_comments_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public."event_comments" add constraint "event_comments_promoted_tip_id_fkey" FOREIGN KEY (promoted_tip_id) REFERENCES place_tips(id) ON DELETE SET NULL;
alter table public."event_comments" add constraint "event_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."event_discovery_candidates" add constraint "event_discovery_candidates_community_signal_fkey" FOREIGN KEY (community_signal_id) REFERENCES community_event_signals(id) ON DELETE SET NULL;
alter table public."event_discovery_candidates" add constraint "event_discovery_candidates_organizer_id_fkey" FOREIGN KEY (organizer_id) REFERENCES known_organizers(id) ON DELETE SET NULL;
alter table public."event_discovery_candidates" add constraint "event_discovery_candidates_promotion_event_fkey" FOREIGN KEY (promotion_event_id) REFERENCES events(id) ON DELETE SET NULL;
alter table public."event_discovery_candidates" add constraint "event_discovery_candidates_source_id_fkey" FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE;
alter table public."event_freshness_checks" add constraint "event_freshness_checks_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."event_freshness_state" add constraint "event_freshness_state_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."event_pipeline_source_health" add constraint "event_pipeline_source_health_source_id_fkey" FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE SET NULL;
alter table public."event_source_trust" add constraint "event_source_trust_source_id_fkey" FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE;
alter table public."events" add constraint "events_added_by_fkey" FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."events" add constraint "events_duplicate_of_event_id_fkey" FOREIGN KEY (duplicate_of_event_id) REFERENCES events(id);
alter table public."events" add constraint "events_duplicate_of_fkey" FOREIGN KEY (duplicate_of) REFERENCES events(id) ON DELETE SET NULL;
alter table public."events" add constraint "events_market_fk" FOREIGN KEY (metro_area) REFERENCES markets(id);
alter table public."events" add constraint "events_place_id_fkey" FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL;
alter table public."events" add constraint "events_program_id_fkey" FOREIGN KEY (program_id) REFERENCES recurring_programs(id) ON DELETE SET NULL;
alter table public."events" add constraint "events_proposed_by_group_fkey" FOREIGN KEY (proposed_by_group) REFERENCES groups(id) ON DELETE CASCADE;
alter table public."events" add constraint "events_source_id_fkey" FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE SET NULL;
alter table public."group_event_plans" add constraint "group_event_plans_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."group_event_plans" add constraint "group_event_plans_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."group_event_plans" add constraint "group_event_plans_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public."group_members" add constraint "group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public."group_members" add constraint "group_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."group_proposal_notifications" add constraint "group_proposal_notifications_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."group_proposal_notifications" add constraint "group_proposal_notifications_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public."group_proposal_notifications" add constraint "group_proposal_notifications_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."groups" add constraint "groups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."known_organizers" add constraint "known_organizers_source_id_fkey" FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE SET NULL;
alter table public."organizer_source_links" add constraint "organizer_source_links_organizer_id_fkey" FOREIGN KEY (organizer_id) REFERENCES organizer_candidates(id) ON DELETE CASCADE;
alter table public."outing_feedback" add constraint "outing_feedback_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."outing_feedback" add constraint "outing_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."place_exposure" add constraint "place_exposure_place_id_fkey" FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
alter table public."place_exposure" add constraint "place_exposure_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."place_geocode_backfill" add constraint "place_geocode_backfill_place_id_fkey" FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
alter table public."place_tips" add constraint "place_tips_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."place_tips" add constraint "place_tips_group_id_fkey" FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
alter table public."place_tips" add constraint "place_tips_place_id_fkey" FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
alter table public."place_tips" add constraint "place_tips_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."places" add constraint "places_market_fk" FOREIGN KEY (metro_area) REFERENCES markets(id);
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."recommendation_feedback" add constraint "recommendation_feedback_request_id_fkey" FOREIGN KEY (request_id) REFERENCES recommendation_requests(id) ON DELETE CASCADE;
alter table public."recommendation_requests" add constraint "recommendation_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."recommendation_response_cache" add constraint "recommendation_response_cache_request_id_fkey" FOREIGN KEY (request_id) REFERENCES recommendation_requests(id) ON DELETE SET NULL;
alter table public."recommendation_response_cache" add constraint "recommendation_response_cache_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."recurring_programs" add constraint "programs_market_fk" FOREIGN KEY (metro_area) REFERENCES markets(id);
alter table public."recurring_programs" add constraint "recurring_programs_place_id_fkey" FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
alter table public."rsvps" add constraint "rsvps_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
alter table public."rsvps" add constraint "rsvps_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Check constraints
alter table public."activity_source_records" add constraint "activity_source_records_check" CHECK ((num_nonnulls(resolved_event_id, resolved_place_id, resolved_program_id) <= 1));
alter table public."activity_source_records" add constraint "activity_source_records_verification_status_check" CHECK ((verification_status = ANY (ARRAY['needs_review'::text, 'verified'::text, 'stale'::text, 'cancelled'::text])));
alter table public."activity_sources" add constraint "activity_sources_feed_format_check" CHECK ((feed_format = ANY (ARRAY['rss'::text, 'ical'::text])));
alter table public."activity_sources" add constraint "activity_sources_last_fetch_status_check" CHECK ((last_fetch_status = ANY (ARRAY['success'::text, 'partial'::text, 'error'::text])));
alter table public."activity_sources" add constraint "activity_sources_source_type_check" CHECK ((source_type = ANY (ARRAY['communico'::text, 'libcal'::text, 'rss'::text, 'ical'::text, 'manual'::text, 'other'::text])));
alter table public."availability" add constraint "availability_check" CHECK ((ends_at > starts_at));
alter table public."availability" add constraint "availability_note_check" CHECK (((note IS NULL) OR (length(note) <= 200)));
alter table public."community_event_signals" add constraint "community_event_signals_status_check" CHECK ((status = ANY (ARRAY['needs_review'::text, 'low_confidence'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])));
alter table public."community_signal_run_audit" add constraint "community_signal_run_audit_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'failed'::text])));
alter table public."content_sources" add constraint "content_sources_community_batch_rank_check" CHECK ((community_batch_rank >= 0));
alter table public."content_sources" add constraint "content_sources_discovery_priority_check" CHECK (((discovery_priority >= 0) AND (discovery_priority <= 100)));
alter table public."content_sources" add constraint "content_sources_reliability_score_check" CHECK (((reliability_score >= 0) AND (reliability_score <= 100)));
alter table public."content_sources" add constraint "content_sources_source_priority_check" CHECK (((source_priority >= 0) AND (source_priority <= 100)));
alter table public."content_sources" add constraint "content_sources_source_type_check" CHECK ((source_type = ANY (ARRAY['ical'::text, 'api'::text, 'structured_web'::text, 'manual'::text, 'discovery'::text])));
alter table public."discovery_queries" add constraint "discovery_queries_priority_check" CHECK (((priority >= 0) AND (priority <= 100)));
alter table public."discovery_runs" add constraint "discovery_runs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'partial'::text, 'failed'::text])));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_age_confidence_check" CHECK (((age_confidence >= (0)::numeric) AND (age_confidence <= (100)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_completeness_check" CHECK (((completeness >= (0)::numeric) AND (completeness <= (100)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_decision_check" CHECK ((decision = ANY (ARRAY['auto_publish_candidate'::text, 'promote_review'::text, 'hold'::text, 'reject'::text])));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_duplicate_confidence_check" CHECK (((duplicate_confidence >= (0)::numeric) AND (duplicate_confidence <= (100)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_family_relevance_check" CHECK (((family_relevance >= (0)::numeric) AND (family_relevance <= (100)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_freshness_check" CHECK (((freshness >= (0)::numeric) AND (freshness <= (100)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_location_confidence_check" CHECK (((location_confidence >= (0)::numeric) AND (location_confidence <= (100)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_quality_score_check" CHECK (((quality_score >= (0)::numeric) AND (quality_score <= (100)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_source_sample_confidence_check" CHECK (((source_sample_confidence >= (0)::numeric) AND (source_sample_confidence <= (1)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_source_trust_check" CHECK (((source_trust >= (0)::numeric) AND (source_trust <= (100)::numeric)));
alter table public."event_candidate_quality" add constraint "event_candidate_quality_time_confidence_check" CHECK (((time_confidence >= (0)::numeric) AND (time_confidence <= (100)::numeric)));
alter table public."event_comments" add constraint "event_comments_body_check" CHECK (((length(TRIM(BOTH FROM body)) > 0) AND (length(body) <= 1000)));
alter table public."event_discovery_candidates" add constraint "candidate_age_exclude_cannot_have_promotion_link" CHECK ((NOT ((age_band = 'exclude'::text) AND (promotion_event_id IS NOT NULL))));
alter table public."event_discovery_candidates" add constraint "candidate_excluded_cannot_have_promotion_link" CHECK ((NOT ((status = 'excluded'::text) AND (promotion_event_id IS NOT NULL))));
alter table public."event_discovery_candidates" add constraint "event_discovery_candidates_candidate_status_check" CHECK ((candidate_status = ANY (ARRAY['discovered'::text, 'enriching'::text, 'validated'::text, 'promoted'::text, 'review'::text, 'deferred'::text, 'rejected'::text, 'duplicate'::text, 'error'::text])));
alter table public."event_duplicate_clusters" add constraint "event_duplicate_clusters_confidence_check" CHECK (((confidence >= 0) AND (confidence <= 100)));
alter table public."event_duplicate_clusters" add constraint "event_duplicate_clusters_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'merged'::text, 'dismissed'::text])));
alter table public."event_freshness_checks" add constraint "event_freshness_checks_freshness_state_check" CHECK ((freshness_state = ANY (ARRAY['fresh'::text, 'due'::text, 'stale'::text, 'expired'::text, 'cancelled'::text, 'completed'::text])));
alter table public."event_freshness_state" add constraint "event_freshness_state_confidence_decay_check" CHECK (((confidence_decay >= (0)::numeric) AND (confidence_decay <= (100)::numeric)));
alter table public."event_freshness_state" add constraint "event_freshness_state_freshness_state_check" CHECK ((freshness_state = ANY (ARRAY['fresh'::text, 'due'::text, 'stale'::text, 'expired'::text, 'cancelled'::text, 'completed'::text])));
alter table public."event_pipeline_alerts" add constraint "event_pipeline_alerts_severity_check" CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'critical'::text])));
alter table public."event_source_trust" add constraint "event_source_trust_prior_score_check" CHECK (((prior_score >= (0)::numeric) AND (prior_score <= (100)::numeric)));
alter table public."event_source_trust" add constraint "event_source_trust_sample_confidence_check" CHECK (((sample_confidence >= (0)::numeric) AND (sample_confidence <= (1)::numeric)));
alter table public."event_source_trust" add constraint "event_source_trust_trust_score_check" CHECK (((trust_score >= (0)::numeric) AND (trust_score <= (100)::numeric)));
alter table public."events" add constraint "events_age_band_check" CHECK ((age_band = ANY (ARRAY['baby'::text, 'toddler'::text, 'preschool'::text, 'family_0_5'::text, 'review'::text, 'exclude'::text])));
alter table public."events" add constraint "events_age_exclude_not_kid_relevant" CHECK (((age_band <> 'exclude'::text) OR (is_kid_relevant = false)));
alter table public."events" add constraint "events_classification_confidence_check" CHECK (((classification_confidence >= 0) AND (classification_confidence <= 100)));
alter table public."events" add constraint "events_content_kid_relevance_consistency" CHECK (((content_status <> 'exclude'::text) OR (is_kid_relevant = false)));
alter table public."events" add constraint "events_content_status_check" CHECK ((content_status = ANY (ARRAY['keep'::text, 'review'::text, 'exclude'::text])));
alter table public."events" add constraint "events_coordinate_pairs_consistent" CHECK ((((lat IS NULL) AND (lng IS NULL) AND (location_latitude IS NULL) AND (location_longitude IS NULL)) OR ((lat IS NOT NULL) AND (lng IS NOT NULL) AND (location_latitude IS NOT NULL) AND (location_longitude IS NOT NULL) AND (lat = location_latitude) AND (lng = location_longitude))));
alter table public."events" add constraint "events_discovery_evening_not_keep" CHECK (((source <> ALL (ARRAY['discovery'::text, 'automated_discovery'::text])) OR (content_status <> 'keep'::text) OR (EXTRACT(hour FROM (starts_at AT TIME ZONE 'America/New_York'::text)) < (19)::numeric)));
alter table public."events" add constraint "events_discovery_priority_check" CHECK (((discovery_priority >= 0) AND (discovery_priority <= 100)));
alter table public."events" add constraint "events_discovery_review_required" CHECK (((source <> ALL (ARRAY['discovery'::text, 'automated_discovery'::text])) OR (content_status <> 'keep'::text)));
alter table public."events" add constraint "events_duplicate_lineage_exclusive" CHECK ((NOT ((duplicate_of IS NOT NULL) AND (duplicate_of_event_id IS NOT NULL))));
alter table public."events" add constraint "events_duplicate_lineage_not_self" CHECK ((((duplicate_of IS NULL) OR (duplicate_of <> id)) AND ((duplicate_of_event_id IS NULL) OR (duplicate_of_event_id <> id))));
alter table public."events" add constraint "events_ends_at_after_starts_at" CHECK (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at >= starts_at)));
alter table public."events" add constraint "events_feed_score_check" CHECK (((feed_score >= 0) AND (feed_score <= 100)));
alter table public."events" add constraint "events_geography_tier_check" CHECK ((geography_tier = ANY (ARRAY['pasco'::text, 'tampa'::text, 'far'::text, 'unknown'::text])));
alter table public."events" add constraint "events_keep_requires_kid_relevant" CHECK (((content_status <> 'keep'::text) OR (is_kid_relevant = true)));
alter table public."events" add constraint "events_keep_requires_published" CHECK (((content_status <> 'keep'::text) OR (status = 'published'::text)));
alter table public."events" add constraint "events_one_time_score_check" CHECK (((one_time_score >= 0) AND (one_time_score <= 100)));
alter table public."events" add constraint "events_published_requires_geo" CHECK (((status <> 'published'::text) OR is_suppressed OR ((lat IS NOT NULL) AND (lng IS NOT NULL))));
alter table public."events" add constraint "events_published_requires_geo_check" CHECK (((status <> 'published'::text) OR is_suppressed OR ((lat IS NOT NULL) AND (lng IS NOT NULL))));
alter table public."events" add constraint "events_recurring_score_check" CHECK (((recurring_score >= 0) AND (recurring_score <= 100)));
alter table public."events" add constraint "events_status_check" CHECK ((status = ANY (ARRAY['published'::text, 'cancelled'::text])));
alter table public."events" add constraint "events_time_precision_check" CHECK ((time_precision = ANY (ARRAY['exact'::text, 'date_only'::text])));
alter table public."events" add constraint "events_time_precision_known_consistency" CHECK ((((time_precision = 'date_only'::text) AND (event_time_known = false)) OR ((time_precision = 'exact'::text) AND (event_time_known = true))));
alter table public."events" add constraint "events_verification_score_check" CHECK (((verification_score >= 0) AND (verification_score <= 100)));
alter table public."events" add constraint "events_verification_tier_check" CHECK ((verification_tier = ANY (ARRAY['trusted'::text, 'high'::text, 'medium'::text, 'low'::text, 'unverified'::text])));
alter table public."group_event_plans" add constraint "group_event_plans_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'planned'::text, 'cancelled'::text])));
alter table public."group_members" add constraint "group_members_things_to_know_check" CHECK (((things_to_know IS NULL) OR (length(things_to_know) <= 300)));
alter table public."known_organizers" add constraint "known_organizers_priority_check" CHECK (((priority >= 0) AND (priority <= 100)));
alter table public."known_organizers" add constraint "known_organizers_reliability_score_check" CHECK (((reliability_score >= (0)::numeric) AND (reliability_score <= (100)::numeric)));
alter table public."organizer_candidates" add constraint "organizer_candidates_confidence_check" CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)));
alter table public."organizer_candidates" add constraint "organizer_candidates_quality_tier_check" CHECK ((quality_tier = ANY (ARRAY['unverified'::text, 'low'::text, 'medium'::text, 'high'::text, 'trusted'::text])));
alter table public."organizer_candidates" add constraint "organizer_candidates_relevance_score_check" CHECK (((relevance_score >= 0) AND (relevance_score <= 100)));
alter table public."organizer_candidates" add constraint "organizer_candidates_status_check" CHECK ((status = ANY (ARRAY['candidate'::text, 'approved'::text, 'rejected'::text, 'monitoring'::text])));
alter table public."organizer_candidates" add constraint "organizer_candidates_verification_score_check" CHECK (((verification_score >= 0) AND (verification_score <= 100)));
alter table public."organizer_source_links" add constraint "organizer_source_links_priority_check" CHECK (((priority >= 0) AND (priority <= 100)));
alter table public."organizer_source_links" add constraint "organizer_source_links_quality_score_check" CHECK (((quality_score >= 0) AND (quality_score <= 100)));
alter table public."organizer_source_links" add constraint "organizer_source_links_source_kind_check" CHECK ((source_kind = ANY (ARRAY['website'::text, 'calendar'::text, 'social'::text, 'announcement'::text, 'registration'::text, 'other'::text])));
alter table public."outing_feedback" add constraint "outing_feedback_note_check" CHECK (((note IS NULL) OR (length(note) <= 300)));
alter table public."outing_feedback" add constraint "outing_feedback_sentiment_check" CHECK (((sentiment IS NULL) OR (sentiment = ANY (ARRAY['loved'::text, 'good'::text, 'not_for_us'::text]))));
alter table public."place_tips" add constraint "place_tips_body_check" CHECK (((length(TRIM(BOTH FROM body)) > 0) AND (length(body) <= 500)));
alter table public."place_tips" add constraint "place_tips_category_check" CHECK ((category = ANY (ARRAY['general'::text, 'parking'::text, 'timing'::text, 'facilities'::text, 'cost'::text, 'accessibility'::text])));
alter table public."place_tips" add constraint "tip_target_present" CHECK (((place_id IS NOT NULL) OR (event_id IS NOT NULL)));
alter table public."places" add constraint "places_coordinate_pairs_consistent" CHECK ((((lat IS NULL) AND (lng IS NULL) AND (latitude IS NULL) AND (longitude IS NULL)) OR ((lat IS NOT NULL) AND (lng IS NOT NULL) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL) AND (lat = latitude) AND (lng = longitude))));
alter table public."places" add constraint "places_llm_verification_status_check" CHECK ((llm_verification_status = ANY (ARRAY['unverified'::text, 'verified'::text, 'needs_review'::text, 'rejected'::text])));
alter table public."profiles" add constraint "profiles_child_age_range" CHECK (((child_age_months IS NULL) OR ((child_age_months >= 0) AND (child_age_months <= 216))));
alter table public."profiles" add constraint "profiles_child_name_length" CHECK (((child_name IS NULL) OR (char_length(child_name) <= 80)));
alter table public."recommendation_feedback" add constraint "recommendation_feedback_feedback_check" CHECK ((feedback = ANY (ARRAY['helpful'::text, 'not_helpful'::text, 'saved'::text, 'dismissed'::text])));
alter table public."rsvps" add constraint "rsvps_note_check" CHECK (((note IS NULL) OR (length(note) <= 200)));
alter table public."rsvps" add constraint "rsvps_status_check" CHECK ((status = ANY (ARRAY['going'::text, 'maybe'::text, 'not_going'::text, 'out_sick'::text])));

-- Indexes not already created by a primary key / unique constraint
CREATE INDEX idx_source_records_dedup_key ON public.activity_source_records USING btree (dedup_key);
CREATE INDEX idx_source_records_resolved_event ON public.activity_source_records USING btree (resolved_event_id) WHERE (resolved_event_id IS NOT NULL);
CREATE INDEX idx_source_records_resolved_place ON public.activity_source_records USING btree (resolved_place_id) WHERE (resolved_place_id IS NOT NULL);
CREATE INDEX idx_source_records_resolved_program ON public.activity_source_records USING btree (resolved_program_id) WHERE (resolved_program_id IS NOT NULL);
CREATE UNIQUE INDEX uniq_source_records_source_external ON public.activity_source_records USING btree (source_id, external_id);
CREATE INDEX idx_activity_sources_market ON public.activity_sources USING btree (metro_area) WHERE active;
CREATE INDEX availability_user_id_idx ON public.availability USING btree (user_id);
CREATE INDEX idx_availability_group_time ON public.availability USING btree (group_id, starts_at);
CREATE INDEX community_event_signals_date_idx ON public.community_event_signals USING btree (event_date);
CREATE UNIQUE INDEX community_event_signals_dedupe_idx ON public.community_event_signals USING btree (source_url, event_title, event_date) WHERE ((source_url IS NOT NULL) AND (event_title IS NOT NULL) AND (event_date IS NOT NULL) AND (status <> 'rejected'::text));
CREATE INDEX community_event_signals_organizer_id_idx ON public.community_event_signals USING btree (organizer_id);
CREATE INDEX community_event_signals_review_idx ON public.community_event_signals USING btree (status, discovered_at DESC);
CREATE UNIQUE INDEX community_event_signals_source_title_date_unique ON public.community_event_signals USING btree (source_url, event_title, event_date) NULLS NOT DISTINCT;
CREATE INDEX community_signal_run_audit_running_idx ON public.community_signal_run_audit USING btree (started_at) WHERE (status = 'running'::text);
CREATE UNIQUE INDEX content_sources_active_canonical_url_uidx ON public.content_sources USING btree (lower(regexp_replace(source_url, '[?#].*$'::text, ''::text))) WHERE ((active = true) AND (source_url IS NOT NULL));
CREATE INDEX content_sources_active_idx ON public.content_sources USING btree (active);
CREATE UNIQUE INDEX content_sources_active_url_unique ON public.content_sources USING btree (source_url) WHERE ((active = true) AND (source_url IS NOT NULL));
CREATE INDEX content_sources_category_priority_idx ON public.content_sources USING btree (active, source_category, discovery_priority DESC);
CREATE INDEX content_sources_community_rotation_idx ON public.content_sources USING btree (active, discovery_channel, last_attempted_at, community_batch_rank, source_priority DESC);
CREATE INDEX content_sources_crawler_due_idx ON public.content_sources USING btree (active, last_attempted_at, source_priority DESC, discovery_priority DESC) WHERE (active = true);
CREATE UNIQUE INDEX content_sources_discovery_canonical_url_uq ON public.content_sources USING btree (lower(regexp_replace(regexp_replace(source_url, '^https?://'::text, ''::text), '[?#].*$'::text, ''::text))) WHERE ((active = true) AND (source_type = 'discovery'::text));
CREATE INDEX content_sources_discovery_channel_priority_idx ON public.content_sources USING btree (active, discovery_channel, source_priority DESC);
CREATE INDEX content_sources_due_crawl_idx ON public.content_sources USING btree (active, next_crawl_at, last_attempted_at) WHERE (active = true);
CREATE INDEX content_sources_organizer_id_idx ON public.content_sources USING btree (organizer_id);
CREATE INDEX content_sources_reliability_idx ON public.content_sources USING btree (reliability_score DESC, active);
CREATE INDEX content_sync_runs_source_idx ON public.content_sync_runs USING btree (source_id, started_at DESC);
CREATE INDEX discovery_queries_active_priority_idx ON public.discovery_queries USING btree (active, priority DESC);
CREATE INDEX discovery_runs_query_id_idx ON public.discovery_runs USING btree (query_id);
CREATE INDEX discovery_runs_started_idx ON public.discovery_runs USING btree (started_at DESC);
CREATE INDEX idx_event_candidate_quality_decision ON public.event_candidate_quality USING btree (decision, quality_score DESC);
CREATE INDEX event_comments_group_id_idx ON public.event_comments USING btree (group_id);
CREATE INDEX event_comments_promoted_tip_id_idx ON public.event_comments USING btree (promoted_tip_id);
CREATE INDEX event_comments_user_id_idx ON public.event_comments USING btree (user_id);
CREATE INDEX idx_comments_event_group ON public.event_comments USING btree (event_id, group_id, created_at DESC);
CREATE INDEX discovery_candidates_90d_idx ON public.event_discovery_candidates USING btree (candidate_status, starts_at) WHERE (starts_at IS NOT NULL);
CREATE INDEX event_discovery_candidates_approved_idx ON public.event_discovery_candidates USING btree (status, starts_at) WHERE (status = 'approved'::text);
CREATE INDEX event_discovery_candidates_candidate_status_idx ON public.event_discovery_candidates USING btree (candidate_status);
CREATE INDEX event_discovery_candidates_canonical_key_idx ON public.event_discovery_candidates USING btree (canonical_key);
CREATE INDEX event_discovery_candidates_community_signal_idx ON public.event_discovery_candidates USING btree (community_signal_id);
CREATE INDEX event_discovery_candidates_content_type_idx ON public.event_discovery_candidates USING btree (content_type, status);
CREATE UNIQUE INDEX event_discovery_candidates_idempotency_key_uq ON public.event_discovery_candidates USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX event_discovery_candidates_organizer_id_idx ON public.event_discovery_candidates USING btree (organizer_id);
CREATE INDEX event_discovery_candidates_organizer_status_idx ON public.event_discovery_candidates USING btree (organizer_id, status);
CREATE INDEX event_discovery_candidates_promotion_event_idx ON public.event_discovery_candidates USING btree (promotion_event_id);
CREATE INDEX event_discovery_candidates_review_score_idx ON public.event_discovery_candidates USING btree (status, score DESC, starts_at);
CREATE INDEX event_discovery_candidates_score_idx ON public.event_discovery_candidates USING btree (score DESC);
CREATE INDEX event_discovery_candidates_starts_at_idx ON public.event_discovery_candidates USING btree (starts_at);
CREATE INDEX event_discovery_candidates_status_idx ON public.event_discovery_candidates USING btree (status);
CREATE INDEX event_duplicate_clusters_status_idx ON public.event_duplicate_clusters USING btree (status, confidence DESC);
CREATE INDEX event_freshness_checks_event_checked_idx ON public.event_freshness_checks USING btree (event_id, checked_at DESC);
CREATE INDEX event_freshness_checks_next_check_idx ON public.event_freshness_checks USING btree (next_check_at) WHERE (freshness_state = ANY (ARRAY['due'::text, 'stale'::text]));
CREATE INDEX event_freshness_state_due_idx ON public.event_freshness_state USING btree (next_check_at) WHERE (freshness_state = ANY (ARRAY['due'::text, 'stale'::text]));
CREATE INDEX idx_event_pipeline_alerts_open ON public.event_pipeline_alerts USING btree (resolved_at, severity, created_at DESC);
CREATE UNIQUE INDEX uq_event_pipeline_alert_open_key ON public.event_pipeline_alerts USING btree (alert_key) WHERE (resolved_at IS NULL);
CREATE INDEX idx_event_pipeline_source_health_checked_at ON public.event_pipeline_source_health USING btree (checked_at DESC);
CREATE INDEX idx_event_pipeline_source_health_source_checked ON public.event_pipeline_source_health USING btree (source_id, checked_at DESC);
CREATE INDEX idx_event_source_trust_auto ON public.event_source_trust USING btree (auto_publish_eligible, trust_score DESC);
CREATE INDEX events_added_by_idx ON public.events USING btree (added_by);
CREATE INDEX events_age_band_idx ON public.events USING btree (age_band, starts_at);
CREATE INDEX events_content_review_idx ON public.events USING btree (content_review_status);
CREATE INDEX events_content_status_idx ON public.events USING btree (content_status, starts_at);
CREATE INDEX events_discovery_priority_idx ON public.events USING btree (discovery_priority DESC, starts_at);
CREATE INDEX events_duplicate_of_idx ON public.events USING btree (duplicate_of_event_id) WHERE (duplicate_of_event_id IS NOT NULL);
CREATE INDEX events_enrichment_queue_idx ON public.events USING btree (starts_at) WHERE ((llm_enriched_at IS NULL) AND (status = 'published'::text));
CREATE INDEX events_feed_score_idx ON public.events USING btree (feed_score DESC, starts_at);
CREATE INDEX events_location_coords_idx ON public.events USING btree (location_latitude, location_longitude) WHERE ((location_latitude IS NOT NULL) AND (location_longitude IS NOT NULL));
CREATE INDEX events_program_id_idx ON public.events USING btree (program_id);
CREATE INDEX events_recommendation_geo_time_idx ON public.events USING btree (starts_at, lat, lng) WHERE (COALESCE(is_suppressed, false) = false);
CREATE INDEX events_recommendation_location_geo_time_idx ON public.events USING btree (starts_at, location_latitude, location_longitude) WHERE (COALESCE(is_suppressed, false) = false);
CREATE INDEX events_source_external_idx ON public.events USING btree (source_id, external_id) WHERE ((source_id IS NOT NULL) AND (external_id IS NOT NULL));
CREATE INDEX events_source_id_idx ON public.events USING btree (source_id);
CREATE INDEX events_starts_at_idx ON public.events USING btree (starts_at);
CREATE INDEX events_starts_at_status_idx ON public.events USING btree (starts_at, status);
CREATE INDEX events_today_filter_idx ON public.events USING btree (starts_at, age_min_months, age_max_months, is_outdoor) WHERE (is_suppressed = false);
CREATE INDEX events_today_idx ON public.events USING btree (starts_at, content_status, age_band, geography_tier);
CREATE INDEX events_verification_idx ON public.events USING btree (verification_tier, verification_score DESC);
CREATE INDEX idx_events_duplicate_of ON public.events USING btree (duplicate_of);
CREATE INDEX idx_events_feed_geo ON public.events USING btree (status, content_status, is_kid_relevant, is_suppressed, starts_at) WHERE ((status = 'published'::text) AND (content_status = 'keep'::text) AND (is_kid_relevant = true) AND (is_suppressed = false) AND (duplicate_of IS NULL));
CREATE INDEX idx_events_kid_relevant ON public.events USING btree (is_kid_relevant, starts_at) WHERE is_kid_relevant;
CREATE INDEX idx_events_metro_starts ON public.events USING btree (metro_area, starts_at);
CREATE INDEX idx_events_place ON public.events USING btree (place_id);
CREATE INDEX idx_events_proposed_group ON public.events USING btree (proposed_by_group);
CREATE UNIQUE INDEX uniq_events_program_external ON public.events USING btree (external_id) WHERE ((program_id IS NOT NULL) AND (external_id IS NOT NULL));
CREATE UNIQUE INDEX uniq_events_source_external_legacy ON public.events USING btree (source, external_id) WHERE ((external_id IS NOT NULL) AND (source_id IS NULL));
CREATE UNIQUE INDEX uniq_events_source_id_external ON public.events USING btree (source_id, external_id) WHERE ((source_id IS NOT NULL) AND (external_id IS NOT NULL));
CREATE INDEX group_event_plans_created_by_idx ON public.group_event_plans USING btree (created_by);
CREATE INDEX group_event_plans_event_idx ON public.group_event_plans USING btree (event_id);
CREATE INDEX group_event_plans_group_idx ON public.group_event_plans USING btree (group_id, created_at DESC);
CREATE UNIQUE INDEX group_event_plans_one_open ON public.group_event_plans USING btree (group_id, event_id) WHERE (status = 'open'::text);
CREATE INDEX idx_group_members_user ON public.group_members USING btree (user_id);
CREATE INDEX group_proposal_notifications_group_id_idx ON public.group_proposal_notifications USING btree (group_id);
CREATE INDEX group_proposal_notifications_recipient_id_idx ON public.group_proposal_notifications USING btree (recipient_id);
CREATE INDEX groups_created_by_idx ON public.groups USING btree (created_by);
CREATE UNIQUE INDEX known_organizers_name_exact_unique ON public.known_organizers USING btree (name);
CREATE UNIQUE INDEX known_organizers_name_unique ON public.known_organizers USING btree (lower(name));
CREATE INDEX known_organizers_priority_active_idx ON public.known_organizers USING btree (active, priority DESC, reliability_score DESC);
CREATE INDEX known_organizers_source_id_idx ON public.known_organizers USING btree (source_id);
CREATE INDEX idx_market_coverage_slo_day ON public.market_coverage_slo USING btree (event_day);
CREATE UNIQUE INDEX organizer_candidates_name_category_locality_uidx ON public.organizer_candidates USING btree (lower(name), lower(category), lower(COALESCE(locality, ''::text)));
CREATE INDEX organizer_candidates_status_score_idx ON public.organizer_candidates USING btree (status, relevance_score DESC, confidence DESC);
CREATE INDEX organizer_quality_idx ON public.organizer_candidates USING btree (quality_tier, verification_score DESC);
CREATE INDEX organizer_source_links_priority_idx ON public.organizer_source_links USING btree (priority DESC, accessible);
CREATE INDEX source_quality_idx ON public.organizer_source_links USING btree (quality_score DESC, relevant_event_yield DESC);
CREATE INDEX outing_feedback_user_id_idx ON public.outing_feedback USING btree (user_id);
CREATE INDEX place_exposure_place_id_idx ON public.place_exposure USING btree (place_id);
CREATE INDEX place_geocode_backfill_place_id_idx ON public.place_geocode_backfill USING btree (place_id);
CREATE INDEX place_revalidation_runs_started_idx ON public.place_revalidation_runs USING btree (started_at DESC);
CREATE INDEX idx_tips_event ON public.place_tips USING btree (event_id, group_id);
CREATE INDEX idx_tips_place ON public.place_tips USING btree (place_id, group_id);
CREATE INDEX place_tips_group_id_idx ON public.place_tips USING btree (group_id);
CREATE INDEX place_tips_user_id_idx ON public.place_tips USING btree (user_id);
CREATE INDEX idx_places_metro ON public.places USING btree (metro_area) WHERE active;
CREATE INDEX places_active_category_tags_gin ON public.places USING gin (category_tags);
CREATE INDEX places_active_priority_idx ON public.places USING btree (discovery_priority DESC) WHERE (active = true);
CREATE INDEX places_active_type_idx ON public.places USING btree (place_type) WHERE (active = true);
CREATE INDEX places_enrichment_queue_idx ON public.places USING btree (id) WHERE ((llm_enriched_at IS NULL) AND (active = true));
CREATE INDEX places_llm_verification_status_idx ON public.places USING btree (llm_verification_status) WHERE (active = true);
CREATE INDEX places_location_coords_idx ON public.places USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));
CREATE INDEX places_recommendation_active_geo_idx ON public.places USING btree (active, lat, lng) WHERE (active = true);
CREATE UNIQUE INDEX places_source_url_unique ON public.places USING btree (source_url) WHERE (source_url IS NOT NULL);
CREATE INDEX profiles_child_activity_preferences_gin_idx ON public.profiles USING gin (child_activity_preferences);
CREATE INDEX profiles_child_interests_gin_idx ON public.profiles USING gin (child_interests);
CREATE INDEX profiles_onboarding_completed_at_idx ON public.profiles USING btree (onboarding_completed_at);
CREATE INDEX recommendation_audit_candidate_idx ON public.recommendation_audit USING btree (candidate_kind, candidate_id, created_at DESC);
CREATE INDEX recommendation_audit_filter_idx ON public.recommendation_audit USING btree (passed_hard_filters, created_at DESC);
CREATE INDEX recommendation_audit_request_idx ON public.recommendation_audit USING btree (request_id, created_at DESC);
CREATE INDEX recommendation_feedback_candidate_idx ON public.recommendation_feedback USING btree (candidate_id, created_at DESC);
CREATE INDEX recommendation_feedback_request_idx ON public.recommendation_feedback USING btree (request_id, created_at DESC);
CREATE INDEX recommendation_requests_user_idx ON public.recommendation_requests USING btree (user_id, created_at DESC);
CREATE INDEX recommendation_response_cache_expiry_idx ON public.recommendation_response_cache USING btree (expires_at);
CREATE INDEX recommendation_response_cache_hash_expiry_idx ON public.recommendation_response_cache USING btree (request_hash, expires_at);
CREATE INDEX recommendation_response_cache_request_id_idx ON public.recommendation_response_cache USING btree (request_id);
CREATE INDEX recommendation_response_cache_user_idx ON public.recommendation_response_cache USING btree (user_id, created_at DESC);
CREATE INDEX idx_programs_active ON public.recurring_programs USING btree (active, metro_area);
CREATE INDEX recurring_programs_metro_area_idx ON public.recurring_programs USING btree (metro_area);
CREATE INDEX recurring_programs_place_id_idx ON public.recurring_programs USING btree (place_id);
CREATE INDEX idx_rsvps_user ON public.rsvps USING btree (user_id);
CREATE INDEX rsvps_event_id_idx ON public.rsvps USING btree (event_id);

-- Functions
CREATE OR REPLACE FUNCTION public.add_creator_as_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.created_by is not null then
    insert into public.group_members (group_id, user_id)
    values (new.id, new.created_by) on conflict do nothing;
  end if;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.add_organizer_source(p_organizer_id uuid, p_source_url text, p_source_kind text, p_priority integer DEFAULT 50)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
 insert into public.organizer_source_links(organizer_id,source_url,source_kind,priority) values(p_organizer_id,p_source_url,p_source_kind,p_priority)
 on conflict(organizer_id,source_url) do update set priority=greatest(organizer_source_links.priority,excluded.priority),accessible=true
 returning id into v_id; return v_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.apply_event_enrichment(p_event_id uuid, p_is_kid_relevant boolean, p_age_band text, p_age_min_months integer, p_age_max_months integer, p_experience_type text, p_is_outdoor boolean, p_weather_fit text, p_confidence integer, p_reason text, p_model text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_conf integer := greatest(0, least(100, coalesce(p_confidence, 0)));
  v_band text := case when p_age_band in ('baby','toddler','preschool','family_0_5','review','exclude') then p_age_band else 'review' end;
  v_content text;
begin
  if p_is_kid_relevant is not true or v_band = 'exclude' then
    v_content := 'exclude';
  elsif v_conf >= 70 then
    v_content := 'keep';
  else
    v_content := 'review';
  end if;

  update public.events
  set is_kid_relevant = coalesce(p_is_kid_relevant, false),
      age_band = v_band,
      age_min_months = coalesce(p_age_min_months, age_min_months),
      age_max_months = coalesce(p_age_max_months, age_max_months),
      experience_type = coalesce(nullif(p_experience_type, ''), experience_type),
      is_outdoor = coalesce(p_is_outdoor, is_outdoor),
      weather_fit = coalesce(nullif(p_weather_fit, ''), weather_fit),
      classification_confidence = v_conf,
      classification_reason = left(coalesce(p_reason, 'llm enrichment'), 500),
      content_status = v_content,
      llm_enriched_at = case when p_model = 'keyword_fallback' then null else now() end,
      llm_model = case when p_model = 'keyword_fallback' then null else p_model end
  where id = p_event_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_local_event_quality_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if coalesce(new.address,'') ~* '(lakeland|orlando|clearwater|st\.? petersburg|sarasota|bradenton|fort myers|jacksonville)' then new.geography_tier:='outside_priority'; if new.status='needs_review' then new.score:=greatest(0,new.score-25); end if; elsif coalesce(new.address,'') ~* '(land o.? lakes|lutz|wesley chapel|new port richey|trinity|zephyrhills|hudson|odessa|san antonio|spring hill|tampa)' or coalesce(new.venue_name,'') ~* '(pasco|tampa|wesley chapel|land o.? lakes|lutz|trinity|zephyrhills|new port richey|hudson|spring hill|odessa)' then new.geography_tier:='priority_local'; if new.status='needs_review' then new.score:=least(100,new.score+15); end if; else new.geography_tier:=coalesce(new.geography_tier,'unknown'); end if; if new.score>=75 and new.geography_tier='priority_local' and new.age_band in ('toddler','preschool','baby') and new.status='needs_review' then new.auto_approved:=true; end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.apply_organizer_feedback()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  oid uuid;
  delta numeric := 0;
  good_inc integer := 0;
  reject_inc integer := 0;
begin
  oid := new.organizer_id;
  if oid is null then return new; end if;

  if new.status in ('approved','published','accepted') then
    delta := 5;
    good_inc := 1;
  elsif new.status in ('rejected','excluded') then
    delta := -3;
    reject_inc := 1;
  else
    return new;
  end if;

  update public.known_organizers
  set reliability_score = greatest(0, least(100, reliability_score + delta)),
      priority = greatest(0, least(100, priority + delta)),
      good_event_count = good_event_count + good_inc,
      rejected_event_count = rejected_event_count + reject_inc,
      last_good_event_at = case when good_inc = 1 then now() else last_good_event_at end,
      updated_at = now()
  where id = oid;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_place_enrichment(p_place_id uuid, p_has_changing_table boolean, p_nursing_friendly boolean, p_stroller_accessible boolean, p_quiet_or_sensory_friendly boolean, p_what_to_bring text[], p_price_note text, p_parking_notes text, p_model text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.places
  set has_changing_table        = coalesce(has_changing_table, p_has_changing_table),
      nursing_friendly          = coalesce(nursing_friendly, p_nursing_friendly),
      stroller_accessible       = coalesce(stroller_accessible, p_stroller_accessible),
      quiet_or_sensory_friendly = coalesce(quiet_or_sensory_friendly, p_quiet_or_sensory_friendly),
      what_to_bring = case
        when (what_to_bring is null or cardinality(what_to_bring) = 0)
             and p_what_to_bring is not null and cardinality(p_what_to_bring) > 0
        then p_what_to_bring else what_to_bring end,
      price_note = case
        when coalesce(btrim(price_note),'') = '' and nullif(btrim(p_price_note),'') is not null
        then p_price_note else price_note end,
      parking_notes = case
        when coalesce(btrim(parking_notes),'') = '' and nullif(btrim(p_parking_notes),'') is not null
        then p_parking_notes else parking_notes end,
      llm_enriched_at = now(),
      llm_model = p_model
  where id = p_place_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_place_enrichment_v2(p_place_id uuid, p_claims jsonb, p_model text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare src text; ev jsonb; accepted jsonb:='{}'::jsonb; rejected text[]:='{}'; k text; v_price text; v_parking text; v_has boolean; v_nurse boolean; v_stroller boolean; v_quiet boolean; accepted_count integer; rejected_count integer; begin select description into src from public.places where id=p_place_id and active=true for update; if src is null then return jsonb_build_object('ok',false,'reason','place_not_found'); end if; ev:=coalesce(p_claims->'evidence','{}'::jsonb); if jsonb_typeof(p_claims->'has_changing_table')='boolean' and public.place_evidence_supported(src,ev->>'has_changing_table') then v_has:=(p_claims->>'has_changing_table')::boolean; accepted:=accepted||jsonb_build_object('has_changing_table',ev->>'has_changing_table'); end if; if jsonb_typeof(p_claims->'nursing_friendly')='boolean' and public.place_evidence_supported(src,ev->>'nursing_friendly') then v_nurse:=(p_claims->>'nursing_friendly')::boolean; accepted:=accepted||jsonb_build_object('nursing_friendly',ev->>'nursing_friendly'); end if; if jsonb_typeof(p_claims->'stroller_accessible')='boolean' and public.place_evidence_supported(src,ev->>'stroller_accessible') then v_stroller:=(p_claims->>'stroller_accessible')::boolean; accepted:=accepted||jsonb_build_object('stroller_accessible',ev->>'stroller_accessible'); end if; if jsonb_typeof(p_claims->'quiet_or_sensory_friendly')='boolean' and public.place_evidence_supported(src,ev->>'quiet_or_sensory_friendly') then v_quiet:=(p_claims->>'quiet_or_sensory_friendly')::boolean; accepted:=accepted||jsonb_build_object('quiet_or_sensory_friendly',ev->>'quiet_or_sensory_friendly'); end if; if jsonb_typeof(p_claims->'what_to_bring')='array' and jsonb_array_length(p_claims->'what_to_bring')>0 and public.place_evidence_supported(src,ev->>'what_to_bring') then accepted:=accepted||jsonb_build_object('what_to_bring',p_claims->'what_to_bring'); end if; if nullif(btrim(p_claims->>'price_note'),'') is not null and public.place_evidence_supported(src,ev->>'price_note') then v_price:=left(btrim(p_claims->>'price_note'),300); accepted:=accepted||jsonb_build_object('price_note',ev->>'price_note'); end if; if nullif(btrim(p_claims->>'parking_notes'),'') is not null and public.place_evidence_supported(src,ev->>'parking_notes') then v_parking:=left(btrim(p_claims->>'parking_notes'),300); accepted:=accepted||jsonb_build_object('parking_notes',ev->>'parking_notes'); end if; for k in select jsonb_object_keys(p_claims) loop if k in ('has_changing_table','nursing_friendly','stroller_accessible','quiet_or_sensory_friendly','what_to_bring','price_note','parking_notes') and p_claims->k is not null and (ev->>k is null or not public.place_evidence_supported(src,ev->>k)) then rejected:=array_append(rejected,k); end if; end loop; select count(*) into accepted_count from jsonb_object_keys(accepted); rejected_count:=coalesce(array_length(rejected,1),0); update public.places set has_changing_table=coalesce(has_changing_table,v_has),nursing_friendly=coalesce(nursing_friendly,v_nurse),stroller_accessible=coalesce(stroller_accessible,v_stroller),quiet_or_sensory_friendly=coalesce(quiet_or_sensory_friendly,v_quiet),price_note=case when coalesce(btrim(price_note),'')='' and v_price is not null then v_price else price_note end,parking_notes=case when coalesce(btrim(parking_notes),'')='' and v_parking is not null then v_parking else parking_notes end,llm_enrichment_evidence=coalesce(llm_enrichment_evidence,'{}'::jsonb)||accepted,llm_enrichment_provenance=coalesce(llm_enrichment_provenance,'{}'::jsonb)||jsonb_build_object('verified_ai',accepted),llm_enriched_at=case when accepted_count>0 then now() else llm_enriched_at end,llm_model=case when accepted_count>0 then p_model else llm_model end,llm_verification_status=case when accepted_count>0 and rejected_count=0 then 'verified' when rejected_count>0 then 'needs_review' else 'unverified' end,llm_verified_at=case when accepted_count>0 and rejected_count=0 then now() else null end,llm_last_revalidation=jsonb_build_object('accepted',accepted,'rejected',to_jsonb(rejected),'verified',accepted_count>0 and rejected_count=0) where id=p_place_id; return jsonb_build_object('ok',true,'accepted',accepted,'rejected',to_jsonb(rejected),'verified',accepted_count>0 and rejected_count=0); end; $function$
;

CREATE OR REPLACE FUNCTION public.apply_place_toddler_gate(p_place_id uuid, p_verdict text, p_age_min_months integer, p_age_max_months integer, p_verdict_quote text, p_age_quote text, p_reasoning text, p_model text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_description text;
  v_final_verdict text;
  v_evidence jsonb;
begin
  if p_verdict not in ('verified','needs_review','rejected') then
    raise exception 'invalid verdict %', p_verdict using errcode = '22023';
  end if;

  select description into v_description from public.places where id = p_place_id and active = true;
  if not found then
    return null;
  end if;

  if p_verdict in ('verified','rejected')
     and not public.place_evidence_supported(v_description, p_verdict_quote) then
    v_final_verdict := 'needs_review';
  else
    v_final_verdict := p_verdict;
  end if;

  v_evidence := jsonb_build_object(
    'verdict', v_final_verdict,
    'claimed_verdict', p_verdict,
    'verdict_quote', p_verdict_quote,
    'age_quote', p_age_quote,
    'reasoning', p_reasoning,
    'model', p_model,
    'checked_at', now()
  );

  update public.places set
    llm_verification_status = v_final_verdict,
    age_min_months = case
      when p_age_min_months is not null and public.place_evidence_supported(v_description, p_age_quote)
      then coalesce(age_min_months, p_age_min_months) else age_min_months end,
    age_max_months = case
      when p_age_max_months is not null and public.place_evidence_supported(v_description, p_age_quote)
      then coalesce(age_max_months, p_age_max_months) else age_max_months end,
    llm_verified_at = case when v_final_verdict in ('verified','rejected') then now() else llm_verified_at end,
    llm_enriched_at = now(),
    llm_model = p_model,
    llm_enrichment_provenance = coalesce(llm_enrichment_provenance, '{}'::jsonb) || jsonb_build_object('toddler_gate', v_evidence),
    llm_last_revalidation = coalesce(llm_last_revalidation, '{}'::jsonb) || jsonb_build_object('toddler_gate_verdict', v_final_verdict, 'toddler_gate_checked_at', now())
  where id = p_place_id and active = true;

  return v_final_verdict;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ask_group_about_event(p_group_id uuid, p_event_id uuid, p_question text DEFAULT 'Anyone want to do this?'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$ declare plan_id uuid; begin if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'not a group member'; end if; if not exists(select 1 from public.feed_events where id=p_event_id) then raise exception 'event not available'; end if; insert into public.group_event_plans(group_id,event_id,created_by,question) values(p_group_id,p_event_id,auth.uid(),coalesce(nullif(trim(p_question),''),'Anyone want to do this?')) on conflict do nothing returning id into plan_id; if plan_id is null then select id into plan_id from public.group_event_plans where group_id=p_group_id and event_id=p_event_id and status='open' limit 1; end if; return plan_id; end; $function$
;

CREATE OR REPLACE FUNCTION public.audit_event_pipeline_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; local_today_start timestamptz; local_today_end timestamptz;
begin
  local_today_start:=date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York';
  local_today_end:=local_today_start+interval '1 day';
  select jsonb_build_object(
    'checked_at',now(),
    'candidates',(select count(*) from public.event_discovery_candidates),
    'candidate_excluded_promoted',(select count(*) from public.event_discovery_candidates c where c.status='excluded' and c.promotion_event_id is not null),
    'candidate_age_exclude_promoted',(select count(*) from public.event_discovery_candidates c where c.age_band='exclude' and c.promotion_event_id is not null),
    'promotion_attempts',(select count(*) from public.event_discovery_candidates where promotion_attempted_at is not null),
    'promotion_links',(select count(*) from public.event_discovery_candidates where promotion_event_id is not null),
    'events',(select count(*) from public.events),
    'negative_duration_events',(select count(*) from public.events where ends_at is not null and ends_at < starts_at),
    'event_coordinate_drift',(select count(*) from public.events where lat is distinct from location_latitude or lng is distinct from location_longitude),
    'place_coordinate_drift',(select count(*) from public.places where lat is distinct from latitude or lng is distinct from longitude),
    'excluded_kid_relevance_violations',(select count(*) from public.events where content_status='exclude' and is_kid_relevant),
    'date_only_exact_violations',(select count(*) from public.events where time_precision='date_only' and event_time_known=true),
    'duplicate_lineage_self_refs',(select count(*) from public.events where duplicate_of=id or duplicate_of_event_id=id),
    'both_duplicate_lineage_fields',(select count(*) from public.events where duplicate_of is not null and duplicate_of_event_id is not null),
    'feed_visible_duplicate_lineage',(select count(*) from public.events where status='published' and content_status='keep' and is_kid_relevant and not is_suppressed and (duplicate_of is not null or duplicate_of_event_id is not null)),
    'published_exclude_events',(select count(*) from public.events where status='published' and content_status='exclude'),
    'published_review_events',(select count(*) from public.events where status='published' and content_status='review'),
    'evening_keep_events',(select count(*) from public.events where status='published' and content_status='keep' and is_kid_relevant and not is_suppressed and extract(hour from (starts_at at time zone 'America/New_York')) >= 19),
    'discovery_keep_events',(select count(*) from public.events where source in ('discovery','automated_discovery') and status='published' and content_status='keep' and is_kid_relevant and not is_suppressed),
    'unsafe_audience_feed_events',(select count(*) from public.events where status='published' and content_status='keep' and is_kid_relevant and not is_suppressed and coalesce(title,'') ~* '(teen|teens|senior|high school|middle school|adult only|adults only|18\\+|21\\+)'),
    'high_confidence_duplicate_clusters_pending',(select count(*) from public.event_duplicate_clusters where status='pending' and confidence >= 95),
    'excluded_status_with_promotion_link',(select count(*) from public.event_discovery_candidates where status='excluded' and promotion_event_id is not null),
    'candidate_status_excluded_count',(select count(*) from public.event_discovery_candidates where status='excluded'),
    'candidate_age_exclude_count',(select count(*) from public.event_discovery_candidates where age_band='exclude'),
    'feed_upcoming',(select count(*) from public.feed_events where starts_at>=now() and ends_at>=now()),
    'feed_next_7_days',(select count(*) from public.feed_events where starts_at>=now() and starts_at<now()+interval '7 days' and ends_at>=now()),
    'feed_today',(select count(*) from public.feed_events where starts_at>=local_today_start and starts_at<local_today_end and ends_at>=now()),
    'feed_floor_target_next_7_days',35,
    'feed_floor_healthy',(select count(*) from public.feed_events where starts_at>=now() and starts_at<now()+interval '7 days' and ends_at>=now())>=35
  ) into result;
  return result;
end; $function$
;

CREATE OR REPLACE FUNCTION public.auto_approve_discovery_candidates()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer := 0;
begin
  with ranked as (
    select id,row_number() over (partition by canonical_key order by score desc, confidence desc, discovered_at desc) rn
    from public.event_discovery_candidates
    where status='needs_review' and starts_at>=now() and starts_at<=now()+interval '90 days'
  ), approved as (
    update public.event_discovery_candidates c
    set status='approved', auto_approved=true, reason='auto-approved: high-confidence toddler/family candidate'
    from ranked r
    where c.id=r.id and r.rn=1 and c.score>=90 and c.confidence>=0.90 and c.age_band in ('baby','toddler','preschool','family_0_5')
    returning c.id
  ) select count(*) into n from approved;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.cancel_event(target_event uuid, reason text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, display_name text, event_title text, starts_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin update public.events set status='cancelled', description=case when reason is null then description else coalesce(description,'') || E'\n\nCANCELLED: ' || reason end where id=target_event; return query select r.user_id,p.display_name,e.title,e.starts_at from public.rsvps r join public.events e on e.id=r.event_id left join public.profiles p on p.id=r.user_id where r.event_id=target_event; end; $function$
;

CREATE OR REPLACE FUNCTION public.candidate_identity_key(p_source_url text, p_starts_at timestamp with time zone, p_title text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$ select md5(lower(trim(coalesce(p_source_url,''))) || '|' || coalesce(to_char(p_starts_at at time zone 'America/New_York','YYYY-MM-DD HH24:MI:SS'),'') || '|' || lower(regexp_replace(trim(coalesce(p_title,'')),'\s+',' ','g'))) $function$
;

CREATE OR REPLACE FUNCTION public.canonicalize_venue()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  base_venue_display text;
  at_position integer;
  title_place text;
begin
  new.venue_name := clean_venue_text(new.venue_name);

  if new.venue_name is not null then
    new.venue_display := btrim(split_part(new.venue_name, ' - ', 1));
    new.room_name := case
      when position(' - ' in new.venue_name) > 0
        then nullif(btrim(substring(new.venue_name from position(' - ' in new.venue_name) + 3)), '')
      else null end;
  end if;

  new.venue_display := btrim(regexp_replace(coalesce(new.venue_display,''), '\s+\d{2,6}\s+[NSEW]?\.?\s*\w+.*$', '', 'i'));
  base_venue_display := nullif(new.venue_display, '');
  select a.canonical into new.venue_display from public.venue_aliases a where new.venue_display ~* a.pattern limit 1;
  new.venue_display := coalesce(new.venue_display, base_venue_display, new.organizer);

  -- final scrub of residual junk
  new.venue_display := clean_venue_text(new.venue_display);
  new.room_name := nullif(clean_venue_text(new.room_name), '');

  new.display_title := new.title;
  at_position := position(' at ' in lower(coalesce(new.title,'')));
  if at_position > 0 and new.venue_display is not null then
    title_place := btrim(substring(new.title from at_position + 4));
    if lower(title_place) = lower(btrim(new.venue_display)) then
      new.display_title := btrim(left(new.title, at_position - 1));
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.classify_event_content_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare s text; recurring boolean; one_time boolean;
begin
 s := lower(coalesce(new.title,'') || ' ' || coalesce(new.description,'') || ' ' || coalesce(new.reason,''));
 recurring := s ~ '(every[[:space:]]+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)|weekly|biweekly|monthly|daily|recurring|ongoing|drop[ -]?in|class(es)?|program|series|session|before[ -]?and[ -]?after|full7|summer [0-9]{2})';
 one_time := s ~ '(one[ -]?time|special event|kids day|family day|open house|grand opening|festival|fair|blast|celebration|workshop|holiday event|back[ -]?to[ -]?school|touch[ -]?a[ -]?truck)';
 if recurring and not one_time then
   new.content_type := 'recurring_activity';
   new.content_type_confidence := .92;
   new.content_type_reason := 'Recurring language or ongoing class/program detected';
 elsif one_time and not recurring then
   new.content_type := 'one_time_event';
   new.content_type_confidence := .9;
   new.content_type_reason := 'Specific special-event language detected';
 elsif recurring and one_time then
   new.content_type := 'event_unknown';
   new.content_type_confidence := .55;
   new.content_type_reason := 'Contains both recurring and special-event signals; review needed';
 else
   new.content_type := coalesce(new.content_type,'event_unknown');
   new.content_type_confidence := coalesce(new.content_type_confidence,.5);
   new.content_type_reason := coalesce(new.content_type_reason,'No strong recurring/one-time signal');
 end if;
 return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.clean_venue_text(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          replace(replace(replace(coalesce(t,''), '\,', ','), '\;', ';'), '\', ''),
        '\s+', ' ', 'g'),
      '[[:space:],–-]+$', '')
    ), '');
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_recommendation_cache()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare n integer; begin delete from public.recommendation_response_cache where expires_at<=now(); get diagnostics n=row_count; return n; end; $function$
;

CREATE OR REPLACE FUNCTION public.cleanup_recommendation_response_cache()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare n integer; begin delete from public.recommendation_response_cache where expires_at < now(); get diagnostics n=row_count; return n; end; $function$
;

CREATE OR REPLACE FUNCTION public.crawler_canary_assertions()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ select jsonb_build_object(
 'market_lutz_center',exists(select 1 from public.markets where id='tampa_bay' and abs(center_lat-28.151123)<0.01 and abs(center_lng+82.461479)<0.01 and radius_minutes=45 and timezone='America/New_York'),
 'rolling_90_day_candidates',exists(select 1 from public.event_discovery_candidates where candidate_status='discovered' and starts_at>now() and starts_at<=now()+interval '90 days'),
 'relevant_0_5_candidates',exists(select 1 from public.event_discovery_candidates where candidate_status='discovered' and age_band in ('baby','toddler','preschool','family_0_5') and starts_at>now() and starts_at<=now()+interval '90 days'),
 'active_places_exist',(select count(*)>0 from public.places where active),
 'discovery_query_coverage',(select count(*)>=100 from public.discovery_queries where active),
 'no_bad_discovery_domains',not exists(select 1 from public.content_sources where active and discovery_channel='crawler_link' and lower(source_url) ~ '(linkedin\\.com|instacart\\.com|facebook\\.com|instagram\\.com|youtube\\.com|reddit\\.com|tiktok\\.com|evvnt\\.com|outlook\\.com|milb\\.com|municode\\.com|gofundme\\.com)'),
 'no_future_adult_entertainment_candidates',not exists(select 1 from public.event_discovery_candidates where candidate_status='discovered' and starts_at>now() and title~*'(tribute|concert|awards?|comedy|orchestra|symphony|opera|nightlife|wine|brewery|distillery)' and title!~*'(kids?|children|family|toddler|preschool|baby|infant|puppet|story|sensory|little|youth)'),
 'no_stale_successful_sources',not exists(select 1 from public.content_sources where active and source_type in ('discovery','structured_web') and last_success_at<now()-interval '48 hours')
); $function$
;

CREATE OR REPLACE FUNCTION public.crawler_record_source_result(p_source_id uuid, p_success boolean, p_yield integer, p_http_status integer DEFAULT NULL::integer, p_duration_ms integer DEFAULT NULL::integer, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f integer; z integer; r integer; begin
select consecutive_failures,consecutive_zero_yield,reliability_score into f,z,r from public.content_sources where id=p_source_id for update;
f:=case when p_success then 0 else coalesce(f,0)+1 end;
z:=case when p_success and coalesce(p_yield,0)=0 then coalesce(z,0)+1 else 0 end;
r:=greatest(0,least(100,coalesce(r,50)+(case when p_success and coalesce(p_yield,0)>0 then 2 when p_success then 0 else -5 end)));
update public.content_sources set consecutive_failures=f,consecutive_zero_yield=z,reliability_score=r,last_http_status=p_http_status,last_crawl_duration_ms=p_duration_ms,last_error=case when p_success then null else left(p_error,1000) end,last_success_at=case when p_success then now() else last_success_at end,next_crawl_at=now()+make_interval(mins=>greatest(30,least(1440,case when f>0 then 120*power(2,least(f,3))::int when z>=3 then 720 when z>=2 then 360 else coalesce(refresh_interval_minutes,720) end))),updated_at=now() where id=p_source_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.crawler_source_health()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
select jsonb_build_object(
'active_sources',(select count(*) from public.content_sources where active),
'never_succeeded',(select count(*) from public.content_sources where active and last_success_at is null),
'stale_over_24h',(select count(*) from public.content_sources where active and last_success_at<now()-interval '24 hours'),
'stale_over_48h',(select count(*) from public.content_sources where active and last_success_at<now()-interval '48 hours'),
'due_sources',(select count(*) from public.content_sources where active and coalesce(next_crawl_at,now())<=now()),
'orphan_running_syncs',(select count(*) from public.content_sync_runs where status='running' and started_at<now()-interval '15 minutes'),
'future_candidates_90d',(select count(*) from public.event_discovery_candidates where candidate_status='discovered' and starts_at between now() and now()+interval '90 days'),
'relevant_candidates_90d',(select count(*) from public.event_discovery_candidates where candidate_status='discovered' and age_band is not null and age_band<>'exclude' and starts_at between now() and now()+interval '90 days'),
'active_places',(select count(*) from public.places where active)
);
$function$
;

CREATE OR REPLACE FUNCTION public.delete_my_account()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  -- Preserve groups that still have other members; remove only truly orphaned
  -- groups created by this account.
  delete from public.groups g
  where g.created_by = uid
    and not exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id <> uid
    );

  delete from auth.users where id = uid;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.discover_places(p_user_id uuid, p_category text DEFAULT NULL::text, p_indoor text DEFAULT 'any'::text, p_max_distance_miles numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, name text, address text, city text, state text, zip_code text, place_type text, category_tags text[], distance_miles numeric, description text, toddler_notes text, price_note text, age_min_months integer, age_max_months integer, is_enclosed boolean, is_outdoor boolean, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, restrooms boolean, quiet_or_sensory_friendly boolean, discovery_priority integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$ with u as (select home_lat,home_lng,child_age_months,coalesce(nullif(p_max_distance_miles,0),max_distance_miles,45)::numeric as max_miles,preferred_categories,preferred_place_types,indoor_preference from profiles where id=p_user_id), base as (select p.*, case when u.home_lat is not null and u.home_lng is not null and p.lat is not null and p.lng is not null then 3958.7613 * 2 * asin(sqrt(power(sin(radians(p.lat-u.home_lat)/2),2)+cos(radians(u.home_lat))*cos(radians(p.lat))*power(sin(radians(p.lng-u.home_lng)/2),2))) end as dist, u.* from places p cross join u where p.active=true and p.public_access=true), filtered as (select * from base where (age_min_months is null or child_age_months is null or age_max_months is null or child_age_months between age_min_months and age_max_months) and (p_category is null or p_category='' or p_category=any(category_tags)) and (p_indoor='any' or p_indoor is null or (p_indoor='indoor' and is_enclosed=true) or (p_indoor='outdoor' and is_outdoor=true)) and (dist is null or dist <= max_miles)) select id,name,address,city,state,zip_code,place_type,category_tags,round(dist::numeric,1),description,toddler_notes,price_note,age_min_months,age_max_months,is_enclosed,is_outdoor,has_changing_table,nursing_friendly,stroller_accessible,restrooms,quiet_or_sensory_friendly,discovery_priority from filtered order by (case when preferred_categories is not null and preferred_categories <> '{}' and category_tags && preferred_categories then 0 else 1 end),(case when preferred_place_types is not null and preferred_place_types <> '{}' and place_type=any(preferred_place_types) then 0 else 1 end),discovery_priority desc,dist nulls last,name limit greatest(1,least(coalesce(p_limit,40),100)); $function$
;

CREATE OR REPLACE FUNCTION public.discovery_coverage_report()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
select jsonb_build_object(
 'active_sources',(select count(*) from content_sources where active),
 'active_queries',(select count(*) from discovery_queries where active),
 'candidates_90d',(select count(*) from event_discovery_candidates where candidate_status='discovered' and starts_at>now() and starts_at<=now()+interval '90 days'),
 'relevant_candidates_90d',(select count(*) from event_discovery_candidates where candidate_status='discovered' and age_band is not null and age_band<>'exclude' and starts_at>now() and starts_at<=now()+interval '90 days'),
 'sources_never_succeeded',(select count(*) from content_sources where active and last_success_at is null),
 'sources_stale_48h',(select count(*) from content_sources where active and last_success_at<now()-interval '48 hours'),
 'discovery_runs_7d',(select count(*) from discovery_runs where started_at>=now()-interval '7 days'),
 'candidate_sources_30d',(select count(distinct source_id) from event_discovery_candidates where discovered_at>=now()-interval '30 days')
); $function$
;

CREATE OR REPLACE FUNCTION public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_candidate_promotion_safety()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if new.promotion_event_id is not null and (new.status='excluded' or new.age_band='exclude') then raise exception 'excluded candidate cannot acquire promotion_event_id'; end if; return new; end; $function$
;

CREATE OR REPLACE FUNCTION public.enforce_candidate_safety_filters()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if new.candidate_status='discovered' and new.promotion_event_id is null and new.promoted_at is null then
  if coalesce(new.title,'') ~* '(poison control|office closures|city office|council meeting|board meeting|advisory committee|committee meeting|conference|networking|professional association|webinar|seminar|clinic|medical|health screening|dental|orthodont|insurance|financial|real estate|direct sales|network marketing)' and coalesce(new.title,'') !~* '(kids?|children|family|toddler|preschool|baby|infant|parent|story|sensory|play)' then
    new.status:='excluded'; new.candidate_status:='rejected'; new.age_band:='exclude'; new.confidence:=.99; new.score:=0; new.auto_approved:=false; new.reason:='service/administrative/professional false positive';
  elsif coalesce(new.title,'') ~* '(tribute|concert|awards?|comedy|orchestra|symphony|opera|nightlife|wine|brewery|distillery)' and coalesce(new.title,'') !~* '(kids?|children|family|toddler|preschool|baby|infant|puppet|story|sensory|little|youth)' then
    new.status:='excluded'; new.candidate_status:='rejected'; new.age_band:='exclude'; new.confidence:=.99; new.score:=0; new.auto_approved:=false; new.reason:='adult entertainment/non-toddler event';
  end if;
 end if;
 return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_crawler_next_crawl()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
if new.last_success_at is distinct from old.last_success_at or new.last_error is distinct from old.last_error then
  if new.last_error is null then
    new.consecutive_failures:=0;
    new.next_crawl_at:=now()+make_interval(mins=>greatest(30,least(1440,coalesce(new.refresh_interval_minutes,720))));
  else
    new.consecutive_failures:=coalesce(old.consecutive_failures,0)+1;
    new.next_crawl_at:=now()+greatest(interval '30 minutes',least(interval '24 hours',power(2,least(new.consecutive_failures,5)) * interval '30 minutes'));
  end if;
end if;
return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_crawler_next_crawl_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare mins integer; begin mins:=greatest(15,coalesce(new.refresh_interval_minutes,720)); if new.last_success_at is distinct from old.last_success_at and new.last_success_at is not null then new.next_crawl_at:=new.last_success_at + make_interval(mins=>mins); end if; if new.consecutive_failures is distinct from old.consecutive_failures and coalesce(new.consecutive_failures,0)>coalesce(old.consecutive_failures,0) then new.next_crawl_at:=now()+make_interval(mins=>least(1440,mins*power(2,greatest(0,new.consecutive_failures-1))::integer)); end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_crawler_source_admission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  h text;
  p text;
  canonical_host text;
begin
  if new.source_url is null then return new; end if;
  h=lower(split_part(split_part(new.source_url,'://',2), '/',1));
  if left(h,4)='www.' then h=substring(h from 5); end if;
  p=lower(coalesce(new.source_url,''));

  if h like 'careers.%' or h like 'help.%' or h like 'resources.%' or h like 'intercom.%'
     or h in ('hud.gov','eventeny.com','unitedparksinvestors.com','seaworld.org','seaworldparks.com','seaworldentertainment.com','google.com','maps.google.com','eventbrite.com','lp.constantcontactpages.com','tiktok.com','app.fulloutsoftware.com','clients.mindbodyonline.com')
     or p ~ '/(login|signin|account|cart|checkout|support|help|privacy|terms|merch|shop/products)(/|\\?|$)'
     or p ~ '(sesameplace.com/en/langhorne|sarasotafair.com|plantcitygov.com)'
  then
    new.active=false;
    new.last_error='quarantined: non-canonical, platform, or outside-market source';
    new.source_priority=least(coalesce(new.source_priority,30),10);
    new.discovery_priority=least(coalesce(new.discovery_priority,30),10);
  end if;

  if coalesce(new.source_type,'')='discovery' and coalesce(new.name,'') ~* ' — discovered(?: — discovered)*$' then
    new.active=false;
    new.last_error='quarantined: recursive discovered-source';
    new.source_priority=least(coalesce(new.source_priority,30),20);
    new.discovery_priority=least(coalesce(new.discovery_priority,30),20);
  end if;

  select lower(split_part(split_part(cs.source_url,'://',2), '/',1))
    into canonical_host
  from public.content_sources cs
  where cs.active=true
    and cs.source_type <> 'discovery'
    and lower(split_part(split_part(cs.source_url,'://',2), '/',1)) = h
  order by greatest(coalesce(cs.source_priority,0),coalesce(cs.discovery_priority,0)) desc
  limit 1;

  if canonical_host is not null and coalesce(new.source_type,'')='discovery'
     and coalesce(new.name,'') ~* ' — discovered'
  then
    new.active=false;
    new.last_error='quarantined: discovered child of canonical source';
    new.source_priority=least(coalesce(new.source_priority,30),20);
    new.discovery_priority=least(coalesce(new.discovery_priority,30),20);
  end if;

  if coalesce(new.consecutive_failures,0) >= 5 and new.active=true then
    new.active=false;
    new.discovery_channel='manual_required';
    new.last_error='quarantined: 5+ consecutive crawler failures; manual review required';
    new.source_priority=least(coalesce(new.source_priority,30),10);
    new.discovery_priority=least(coalesce(new.discovery_priority,30),10);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_discovery_candidate_safety()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if new.candidate_status='discovered' then if new.starts_at is null or new.starts_at<now() or new.starts_at>now()+interval '90 days' then new.candidate_status:=case when new.starts_at is not null and new.starts_at>now()+interval '90 days' then 'deferred' else 'rejected' end; new.promotion_error:=coalesce(new.promotion_error,'outside active discovery window'); end if; if new.age_band is null or new.age_band='exclude' then new.candidate_status:='rejected'; new.promotion_error:=coalesce(new.promotion_error,'missing or excluded age band'); end if; if coalesce(new.content_type,'event_unknown') in ('event_unknown','unknown') then new.candidate_status:='review'; new.auto_approved:=false; new.promotion_error:=coalesce(new.promotion_error,'unknown content type requires review'); end if; if lower(coalesce(new.title,'')||' '||coalesce(new.description,'')) ~ '(teen|adult only|adults only|21\\+|18\\+|volunteer training|board meeting|annual meeting|city council|charter review|civil service board|commission meeting|luncheon|hiit|zumba|yoga in the park|jazz jam|adult concert|parents? night out|ladies night)' and lower(coalesce(new.title,'')||' '||coalesce(new.description,'')) !~ '(family|children|kids|child|toddler|preschool|baby|youth)' then new.candidate_status:='rejected'; new.auto_approved:=false; new.promotion_error:=coalesce(new.promotion_error,'adult/professional/non-family content'); end if; end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_discovery_promotion_readiness()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if new.candidate_status='discovered' then if coalesce(new.geography_tier,'unknown')='unknown' then new.candidate_status:='deferred'; new.promotion_error:='geography_verification_required'; elsif coalesce(new.content_type,'event_unknown')='event_unknown' then new.candidate_status:='deferred'; new.promotion_error:='content_type_verification_required'; elsif new.age_band='review' then new.candidate_status:='deferred'; new.promotion_error:='age_band_verification_required'; end if; end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.enforce_event_freshness_publish_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status='published' and new.content_status='keep' and exists (select 1 from public.event_freshness_state s where s.event_id=new.id and s.freshness_state in ('stale','cancelled','completed')) then
    raise exception 'event freshness state prevents keep publishing';
  end if;
  if new.status='published' and new.content_status='keep' and exists (select 1 from public.event_freshness_state s where s.event_id=new.id and s.freshness_state='due') then
    new.content_status := 'review';
    new.content_review_status := 'pending';
    new.content_review_reason := 'Freshness verification required before keep publishing';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_event_publication_safety()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status = 'published' and new.content_status = 'keep' then
    if coalesce(new.is_kid_relevant,false) = false
       or coalesce(new.is_suppressed,false)
       or new.duplicate_of is not null
       or new.duplicate_of_event_id is not null
       or coalesce(new.verification_score,0) < 80
       or (new.source_id is null and new.added_by is null)
       or coalesce(new.lat,new.location_latitude) is null
       or coalesce(new.lng,new.location_longitude) is null
       or coalesce(new.event_time_known,false) = false
    then
      new.content_status := 'review';
      new.content_review_status := 'pending';
      new.content_review_reason := 'Publication safety gate failed';
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_verified_feed_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status='published'
     and coalesce(new.content_review_status,'') <> 'cancelled'
     and new.is_kid_relevant
     and not new.is_suppressed
     and coalesce(new.verification_score,0)>=80
     and new.age_band in ('baby','toddler','preschool','family_0_5')
     and new.source not in ('discovery','automated_discovery')
     and new.duplicate_of is null
     and new.duplicate_of_event_id is null
     and (new.source_id is not null or new.added_by is not null)
     and coalesce(new.lat,new.location_latitude) is not null
     and coalesce(new.lng,new.location_longitude) is not null
     and coalesce(new.event_time_known,false)
     and not exists (select 1 from public.event_freshness_state s where s.event_id=new.id and s.freshness_state in ('due','stale','cancelled','completed'))
  then
    new.content_status := 'keep';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.evaluate_event_discovery_candidate_shadow(p_candidate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare c public.event_discovery_candidates%rowtype; src public.content_sources%rowtype; existing_event_id uuid; resolved_place_id uuid; normalized_title text; candidate_local_date date; normalized_text text; outcome text; reason text; begin select * into c from public.event_discovery_candidates ec where ec.id=p_candidate_id; if not found then return jsonb_build_object('candidate_id',p_candidate_id,'outcome','not_found','would_promote',false,'would_defer',false,'would_reject',false,'would_duplicate',false); end if; if nullif(btrim(c.title),'') is null then outcome:='defer'; reason:='title_required'; elsif c.starts_at is null then outcome:='defer'; reason:='trustworthy_starts_at_required'; else select * into src from public.content_sources s where s.id=c.source_id and s.active is distinct from false; if not found then outcome:='defer'; reason:='resolvable_source_required'; elsif c.status='excluded' then outcome:='reject'; reason:='candidate_status_excluded'; elsif c.age_band='exclude' then outcome:='reject'; reason:='age_band_exclude'; elsif c.age_band is not null and c.age_band not in ('baby','toddler','preschool','family_0_5','review','exclude') then outcome:='reject'; reason:='invalid_age_band'; else normalized_text:=lower(coalesce(c.title,'')||' '||coalesce(c.description,'')); if normalized_text ~ '(wedding|adult only|adults only|18\+|21\+|nightclub|strip club|bar crawl|bachelor party|bachelorette party|burlesque|porn|erotic|sex party|casino)' then outcome:='reject'; reason:='obvious_non_family_event'; else normalized_title:=regexp_replace(lower(trim(coalesce(c.title,''))),'[^a-z0-9]+',' ','g'); candidate_local_date:=(c.starts_at at time zone 'America/New_York')::date; resolved_place_id:=null; if nullif(btrim(c.address),'') is not null then select p.id into resolved_place_id from public.places p where lower(trim(coalesce(p.address,'')))=lower(trim(c.address)) order by case when nullif(btrim(c.venue_name),'') is not null and lower(trim(coalesce(p.name,'')))=lower(trim(c.venue_name)) then 0 else 1 end limit 1; end if; if resolved_place_id is null and nullif(btrim(c.venue_name),'') is not null then select p.id into resolved_place_id from public.places p where lower(trim(coalesce(p.name,'')))=lower(trim(c.venue_name)) and (nullif(btrim(c.address),'') is null or lower(trim(coalesce(p.address,'')))=lower(trim(c.address))) limit 1; end if; existing_event_id:=null; if c.external_id is not null then select e.id into existing_event_id from public.events e where e.source_id=c.source_id and e.external_id=c.external_id order by e.id limit 1; end if; if existing_event_id is null then select e.id into existing_event_id from public.events e where regexp_replace(lower(trim(coalesce(e.title,''))),'[^a-z0-9]+',' ','g')=normalized_title and (e.starts_at at time zone 'America/New_York')::date=candidate_local_date and ((resolved_place_id is not null and e.place_id=resolved_place_id) or (resolved_place_id is null and nullif(btrim(c.address),'') is not null and lower(trim(coalesce(e.address,'')))=lower(trim(c.address)))) order by e.id limit 1; end if; if existing_event_id is not null then outcome:='duplicate'; reason:='canonical duplicate'; else outcome:='promote'; reason:=coalesce(c.reason,'candidate passed shadow safety checks'); end if; end if; end if; end if; return jsonb_build_object('candidate_id',c.id,'outcome',outcome,'would_promote',outcome='promote','would_defer',outcome='defer','would_reject',outcome='reject','would_duplicate',outcome='duplicate','duplicate_event_id',existing_event_id,'source_id',c.source_id,'source_resolved',src.id is not null,'place_id',resolved_place_id,'age_band',c.age_band,'confidence',c.confidence,'classification_reason',c.reason,'defer_reason',case when outcome='defer' then reason end,'rejection_reason',case when outcome='reject' then reason end); exception when others then return jsonb_build_object('candidate_id',p_candidate_id,'outcome','error','would_promote',false,'would_defer',false,'would_reject',false,'would_duplicate',false,'error',sqlerrm,'sqlstate',sqlstate); end $function$
;

CREATE OR REPLACE FUNCTION public.event_local_hour(ts timestamp with time zone)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select extract(hour from (ts at time zone 'America/New_York')) + extract(minute from (ts at time zone 'America/New_York')) / 60.0;
$function$
;

CREATE OR REPLACE FUNCTION public.execute_recommendation_request(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone, p_limit integer DEFAULT 15)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare gate jsonb; candidates jsonb; dist numeric; age integer; indoor boolean; max_price numeric; begin gate := public.validate_recommendation_request(p_constraints,p_start,p_end); if coalesce((gate->>'valid')::boolean,false)=false then return jsonb_build_object('ok',false,'validation',gate); end if; dist := coalesce((gate->'constraints'->>'max_distance_miles')::numeric,25); age := (gate->'constraints'->>'child_age_months')::integer; indoor := (gate->'constraints'->>'indoor')::boolean; max_price := (gate->'constraints'->>'max_price')::numeric; select coalesce(jsonb_agg(to_jsonb(x) order by x.distance_miles nulls last,x.starts_at nulls last),'[]'::jsonb) into candidates from public.get_recommendation_candidates(p_lat,p_lng,p_start,p_end,dist,age,indoor,false,false,false,false,max_price,p_limit) x; return jsonb_build_object('ok',true,'validation',gate,'candidate_count',jsonb_array_length(candidates),'candidates',candidates); end; $function$
;

CREATE OR REPLACE FUNCTION public.filter_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision DEFAULT 25, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 15)
 RETURNS TABLE(kind text, id uuid, name text, description text, distance_miles double precision, starts_at timestamp with time zone, price_note text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, activity_vibe text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select * from public.get_recommendation_candidates(p_lat,p_lng,p_max_distance_miles,p_child_age_months,p_indoor,p_limit); $function$
;

CREATE OR REPLACE FUNCTION public.get_cached_recommendation(p_request_hash text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select response from public.recommendation_response_cache where request_hash=p_request_hash and expires_at>now() limit 1; $function$
;

CREATE OR REPLACE FUNCTION public.get_events_for_enrichment(p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, title text, description text, venue_name text, source text, age_min_months integer, age_max_months integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.id, e.title, e.description, e.venue_name,
         e.source, e.age_min_months, e.age_max_months
  from public.events e
  where e.status = 'published'
    and e.starts_at > now()
    and e.llm_enriched_at is null
  order by e.starts_at asc
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$function$
;

CREATE OR REPLACE FUNCTION public.get_freshness_queue(limit_count integer DEFAULT 100)
 RETURNS TABLE(event_id uuid, freshness_state text, starts_at timestamp with time zone, next_check_at timestamp with time zone, reason text, confidence_decay numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
select s.event_id,s.freshness_state,e.starts_at,s.next_check_at,s.reason,s.confidence_decay
from event_freshness_state s join events e on e.id=s.event_id
where s.freshness_state in ('due','stale') and e.status='published'
order by s.next_check_at nulls first,e.starts_at
limit greatest(1,least(limit_count,1000));
$function$
;

CREATE OR REPLACE FUNCTION public.get_gemini_key()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'gemini_key'
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_places_for_enrichment(p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, name text, description text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.name, p.description
  from public.places p
  where p.active = true
    and p.llm_enriched_at is null
    and p.description is not null
    and length(btrim(p.description)) >= 40
  order by p.id
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$function$
;

CREATE OR REPLACE FUNCTION public.get_places_for_revalidation(p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, name text, description text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select p.id,p.name,p.description from public.places p where p.active=true and (p.llm_verification_status is distinct from 'verified' or coalesce(p.facility_data_source,'unknown')='legacy_unknown') and coalesce(p.description,'')<>'' order by p.llm_enriched_at nulls first,p.name limit greatest(1,least(coalesce(p_limit,10),50)); $function$
;

CREATE OR REPLACE FUNCTION public.get_places_for_toddler_gate(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, name text, description text, category_tags text[], place_type text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select p.id, p.name, p.description, p.category_tags, p.place_type
  from public.places p
  where p.active = true
    and p.llm_verification_status not in ('verified','rejected')
  order by p.llm_enriched_at nulls first, p.name
  limit greatest(1, least(coalesce(p_limit,50), 200));
$function$
;

CREATE OR REPLACE FUNCTION public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision DEFAULT 25, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 15)
 RETURNS TABLE(kind text, id uuid, name text, description text, distance_miles double precision, starts_at timestamp with time zone, price_note text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, activity_vibe text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ with places_q as (select 'place'::text kind,p.id,p.name,p.description,case when p.lat is not null and p.lng is not null then 3958.7613*2*asin(sqrt(power(sin(radians(p.lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(p.lat))*power(sin(radians(p.lng-p_lng)/2),2))) end distance_miles,null::timestamptz starts_at,p.price_note,p.has_changing_table,p.nursing_friendly,p.stroller_accessible,p.quiet_or_sensory_friendly,null::text activity_vibe from public.places p where p.active=true and p.llm_verification_status='verified'), events_q as (select 'event'::text kind,e.id,e.description,e.title name,case when coalesce(e.location_latitude,e.lat) is not null and coalesce(e.location_longitude,e.lng) is not null then 3958.7613*2*asin(sqrt(power(sin(radians(coalesce(e.location_latitude,e.lat)-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(coalesce(e.location_latitude,e.lat)))*power(sin(radians(coalesce(e.location_longitude,e.lng)-p_lng)/2),2))) end distance_miles,e.starts_at,e.cost price_note,null::boolean has_changing_table,null::boolean nursing_friendly,null::boolean stroller_accessible,null::boolean quiet_or_sensory_friendly,e.experience_type activity_vibe from public.events e where e.starts_at>=now() and coalesce(e.is_suppressed,false)=false and coalesce(e.content_status,'') not in ('rejected','suppressed') and (p_child_age_months is null or e.age_min_months is null or e.age_max_months is null or (p_child_age_months between e.age_min_months and e.age_max_months))), all_q as (select * from places_q union all select * from events_q), ranked as (select q.*,row_number() over(partition by q.kind,q.id order by q.distance_miles nulls last,q.starts_at nulls last) rn from all_q q) select kind,id,name,description,distance_miles,starts_at,price_note,has_changing_table,nursing_friendly,stroller_accessible,quiet_or_sensory_friendly,activity_vibe from ranked where rn=1 and (distance_miles is null or distance_miles<=greatest(0,p_max_distance_miles)) order by distance_miles nulls last,starts_at nulls last limit greatest(1,least(coalesce(p_limit,15),50)); $function$
;

CREATE OR REPLACE FUNCTION public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision DEFAULT 25, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 15, p_start timestamp with time zone DEFAULT now(), p_end timestamp with time zone DEFAULT (now() + '31 days'::interval))
 RETURNS TABLE(kind text, id uuid, name text, description text, distance_miles double precision, starts_at timestamp with time zone, price_note text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, activity_vibe text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ with events_q as (select 'event'::text kind,e.id,coalesce(e.title,'') name,e.description,case when coalesce(e.location_latitude,e.lat) is not null and coalesce(e.location_longitude,e.lng) is not null then 3958.7613*2*asin(sqrt(power(sin(radians(coalesce(e.location_latitude,e.lat)-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(coalesce(e.location_latitude,e.lat)))*power(sin(radians(coalesce(e.location_longitude,e.lng)-p_lng)/2),2))) end distance_miles,e.starts_at,e.cost price_note,null::boolean has_changing_table,null::boolean nursing_friendly,null::boolean stroller_accessible,null::boolean quiet_or_sensory_friendly,e.experience_type activity_vibe from public.events e where e.starts_at>=p_start and e.starts_at<p_end and coalesce(e.is_suppressed,false)=false and coalesce(e.content_status,'') not in ('rejected','suppressed') and (p_child_age_months is null or e.age_min_months is null or e.age_max_months is null or p_child_age_months between e.age_min_months and e.age_max_months) and (p_indoor is null or e.is_outdoor is null or e.is_outdoor <> p_indoor)), places_q as (select 'place'::text kind,p.id,p.name,p.description,case when p.lat is not null and p.lng is not null then 3958.7613*2*asin(sqrt(power(sin(radians(p.lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(p.lat))*power(sin(radians(p.lng-p_lng)/2),2))) end distance_miles,null::timestamptz starts_at,p.price_note,p.has_changing_table,p.nursing_friendly,p.stroller_accessible,p.quiet_or_sensory_friendly,null::text activity_vibe from public.places p where p.active=true and p.llm_verification_status='verified' and (p_child_age_months is null or p.age_min_months is null or p.age_max_months is null or p_child_age_months between p.age_min_months and p.age_max_months) and (p_indoor is null or p.is_outdoor is null or p.is_outdoor <> p_indoor)),all_q as (select * from events_q union all select * from places_q) select kind,id,name,description,distance_miles,starts_at,price_note,has_changing_table,nursing_friendly,stroller_accessible,quiet_or_sensory_friendly,activity_vibe from all_q where distance_miles is null or distance_miles<=greatest(0,p_max_distance_miles) order by distance_miles nulls last,starts_at nulls last limit greatest(1,least(coalesce(p_limit,15),50)); $function$
;

CREATE OR REPLACE FUNCTION public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision DEFAULT 20, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 30)
 RETURNS TABLE(kind text, id uuid, title text, description text, venue_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, distance_miles double precision, age_min_months integer, age_max_months integer, is_outdoor boolean, weather_fit text, cost text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, source_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ with ec as (select 'event'::text kind,e.id,e.title,e.description,e.venue_name,e.starts_at,e.ends_at,case when coalesce(e.location_latitude,e.lat) is not null and coalesce(e.location_longitude,e.lng) is not null then 3958.7613*acos(least(1,greatest(-1,sin(radians(p_lat))*sin(radians(coalesce(e.location_latitude,e.lat)))+cos(radians(p_lat))*cos(radians(coalesce(e.location_latitude,e.lat)))*cos(radians(coalesce(e.location_longitude,e.lng)-p_lng))))) end distance_miles,e.age_min_months,e.age_max_months,e.is_outdoor,e.weather_fit,e.cost,null::boolean,null::boolean,null::boolean,null::boolean,e.source_url from public.events e where coalesce(e.is_suppressed,false)=false and coalesce(e.content_status,'') not in ('rejected','suppressed') and e.starts_at>=p_start and e.starts_at<p_end and (p_child_age_months is null or (coalesce(e.age_min_months,0)<=p_child_age_months and (e.age_max_months is null or e.age_max_months>=p_child_age_months))) and (p_indoor is null or e.is_outdoor is distinct from p_indoor)),pc as (select 'place'::text kind,p.id,p.name,p.description,p.name,null::timestamptz,null::timestamptz,case when coalesce(p.latitude,p.lat) is not null and coalesce(p.longitude,p.lng) is not null then 3958.7613*acos(least(1,greatest(-1,sin(radians(p_lat))*sin(radians(coalesce(p.latitude,p.lat)))+cos(radians(p_lat))*cos(radians(coalesce(p.latitude,p.lat)))*cos(radians(coalesce(p.longitude,p.lng)-p_lng))))) end distance_miles,p.age_min_months,p.age_max_months,p.is_outdoor,null::text,p.price_note,case when p.llm_verification_status='verified' then p.has_changing_table else null end,case when p.llm_verification_status='verified' then p.nursing_friendly else null end,case when p.llm_verification_status='verified' then p.stroller_accessible else null end,case when p.llm_verification_status='verified' then p.quiet_or_sensory_friendly else null end,p.website from public.places p where p.active=true and (p_child_age_months is null or (coalesce(p.age_min_months,0)<=p_child_age_months and (p.age_max_months is null or p.age_max_months>=p_child_age_months))) and (p_indoor is null or p.is_outdoor is distinct from p_indoor)) select * from (select * from ec union all select * from pc) x where distance_miles is not null and distance_miles<=p_max_distance_miles order by starts_at nulls last,distance_miles limit greatest(1,least(p_limit,100)); $function$
;

CREATE OR REPLACE FUNCTION public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision DEFAULT 20, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_needs_changing_table boolean DEFAULT false, p_needs_nursing_friendly boolean DEFAULT false, p_needs_stroller_accessible boolean DEFAULT false, p_needs_quiet_or_sensory_friendly boolean DEFAULT false, p_budget_max numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 30)
 RETURNS TABLE(kind text, id uuid, title text, description text, venue_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, distance_miles double precision, age_min_months integer, age_max_months integer, is_outdoor boolean, weather_fit text, cost text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, source_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH event_base AS (
  SELECT p.*, coalesce(p.location_latitude,p.lat) AS xlat,
         coalesce(p.location_longitude,p.lng) AS xlng
  FROM public.poppy_recommendation_candidates p
  WHERE p.starts_at >= p_start AND p.starts_at < p_end
),
event_candidates AS (
  SELECT 'event'::text kind, e.id, e.title, e.description, e.venue_name,
         e.starts_at, e.ends_at,
         CASE WHEN e.xlat IS NOT NULL AND e.xlng IS NOT NULL THEN
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(e.xlat))+
             cos(radians(p_lat))*cos(radians(e.xlat))*cos(radians(e.xlng-p_lng))
           ))) END distance_miles,
         e.age_min_months, e.age_max_months, e.is_outdoor, e.weather_fit, e.cost,
         NULL::boolean,NULL::boolean,NULL::boolean,NULL::boolean,e.source_url
  FROM event_base e
  WHERE (p_child_age_months IS NULL OR
         (coalesce(e.age_min_months,0) <= p_child_age_months AND
          (e.age_max_months IS NULL OR e.age_max_months >= p_child_age_months)))
    AND (p_indoor IS NULL OR e.is_outdoor IS DISTINCT FROM p_indoor)
    AND (p_budget_max IS NULL OR lower(trim(coalesce(e.cost,''))) = 'free')
),
place_base AS (
  SELECT p.*, coalesce(p.latitude,p.lat) AS xlat,
         coalesce(p.longitude,p.lng) AS xlng
  FROM public.places p
),
place_candidates AS (
  SELECT 'place'::text kind, p.id, p.name, p.description, p.name,
         NULL::timestamptz, NULL::timestamptz,
         CASE WHEN p.xlat IS NOT NULL AND p.xlng IS NOT NULL THEN
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(p.xlat))+
             cos(radians(p_lat))*cos(radians(p.xlat))*cos(radians(p.xlng-p_lng))
           ))) END distance_miles,
         p.age_min_months, p.age_max_months, p.is_outdoor, NULL::text,
         p.price_note, p.has_changing_table, p.nursing_friendly,
         p.stroller_accessible, p.quiet_or_sensory_friendly, p.website
  FROM place_base p
  WHERE p.active=true
    AND p.llm_verification_status='verified'
    AND (p_child_age_months IS NULL OR
         (coalesce(p.age_min_months,0) <= p_child_age_months AND
          (p.age_max_months IS NULL OR p.age_max_months >= p_child_age_months)))
    AND (p_indoor IS NULL OR p.is_outdoor IS DISTINCT FROM p_indoor)
    AND (NOT p_needs_changing_table OR p.has_changing_table=true)
    AND (NOT p_needs_nursing_friendly OR p.nursing_friendly=true)
    AND (NOT p_needs_stroller_accessible OR p.stroller_accessible=true)
    AND (NOT p_needs_quiet_or_sensory_friendly OR p.quiet_or_sensory_friendly=true)
    AND (p_budget_max IS NULL OR lower(trim(coalesce(p.price_note,''))) = 'free')
)
SELECT * FROM (SELECT * FROM event_candidates UNION ALL SELECT * FROM place_candidates) x
WHERE distance_miles IS NOT NULL
  AND distance_miles <= least(greatest(coalesce(p_max_distance_miles,20),1),45)
ORDER BY starts_at NULLS LAST, distance_miles
LIMIT greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision DEFAULT 20, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_needs_changing_table boolean DEFAULT false, p_needs_nursing_friendly boolean DEFAULT false, p_needs_stroller_accessible boolean DEFAULT false, p_needs_quiet_or_sensory_friendly boolean DEFAULT false, p_limit integer DEFAULT 30)
 RETURNS TABLE(kind text, id uuid, title text, description text, venue_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, distance_miles double precision, age_min_months integer, age_max_months integer, is_outdoor boolean, weather_fit text, cost text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, source_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with event_base as (
  select p.*, coalesce(p.location_latitude,p.lat) as xlat,
         coalesce(p.location_longitude,p.lng) as xlng
  from public.poppy_recommendation_candidates p
  where p.starts_at >= p_start and p.starts_at < p_end
),
event_candidates as (
  select 'event'::text kind, e.id, e.title, e.description, e.venue_name,
         e.starts_at, e.ends_at,
         case when e.xlat is not null and e.xlng is not null then
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(e.xlat))+
             cos(radians(p_lat))*cos(radians(e.xlat))*cos(radians(e.xlng-p_lng))
           )))
         end distance_miles,
         e.age_min_months, e.age_max_months, e.is_outdoor, e.weather_fit, e.cost,
         null::boolean, null::boolean, null::boolean, null::boolean, e.source_url
  from event_base e
  where (p_child_age_months is null or
         (coalesce(e.age_min_months,0) <= p_child_age_months and
          (e.age_max_months is null or e.age_max_months >= p_child_age_months)))
    and (p_indoor is null or e.is_outdoor is distinct from p_indoor)
),
place_base as (
  select p.*, coalesce(p.latitude,p.lat) as xlat,
         coalesce(p.longitude,p.lng) as xlng
  from public.places p
),
place_candidates as (
  select 'place'::text kind, p.id, p.name, p.description, p.name,
         null::timestamptz, null::timestamptz,
         case when p.xlat is not null and p.xlng is not null then
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(p.xlat))+
             cos(radians(p_lat))*cos(radians(p.xlat))*cos(radians(p.xlng-p_lng))
           )))
         end distance_miles,
         p.age_min_months, p.age_max_months, p.is_outdoor, null::text,
         p.price_note, p.has_changing_table, p.nursing_friendly,
         p.stroller_accessible, p.quiet_or_sensory_friendly, p.website
  from place_base p
  where p.active=true
    and p.llm_verification_status='verified'
    and (p_child_age_months is null or
         (coalesce(p.age_min_months,0) <= p_child_age_months and
          (p.age_max_months is null or p.age_max_months >= p_child_age_months)))
    and (p_indoor is null or p.is_outdoor is distinct from p_indoor)
    and (not p_needs_changing_table or p.has_changing_table=true)
    and (not p_needs_nursing_friendly or p.nursing_friendly=true)
    and (not p_needs_stroller_accessible or p.stroller_accessible=true)
    and (not p_needs_quiet_or_sensory_friendly or p.quiet_or_sensory_friendly=true)
)
select * from (select * from event_candidates union all select * from place_candidates) x
where distance_miles is not null
  and distance_miles <= least(greatest(p_max_distance_miles,1),50)
order by starts_at nulls last, distance_miles
limit greatest(1,least(p_limit,100));
$function$
;

CREATE OR REPLACE FUNCTION public.get_recommendation_learning_summary(p_candidate_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select jsonb_build_object('helpful',count(*) filter(where feedback in ('helpful','saved')),'not_helpful',count(*) filter(where feedback in ('not_helpful','dismissed')),'saved',count(*) filter(where feedback='saved'),'dismissed',count(*) filter(where feedback='dismissed')) from public.recommendation_feedback where candidate_id=p_candidate_id; $function$
;

CREATE OR REPLACE FUNCTION public.guard_recurring_event_occurrence()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  rule text;
begin
  if new.program_id is not null then
    select r.rrule into rule from public.recurring_programs r where r.id = new.program_id;
    if rule is not null and not public.recurrence_occurrence_matches(new.starts_at, rule) then
      new.is_suppressed := true;
      new.verification_reasons := coalesce(new.verification_reasons, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('code','invalid_recurrence_occurrence','rrule',rule));
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_source_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cs record;
begin
  if new.source_id is not null then
    select id,active,source_type,reliability_score,last_success_at,last_event_count into cs from public.content_sources where id=new.source_id;
    if coalesce(cs.active,false) and cs.source_type='structured_web' and coalesce(cs.reliability_score,0)>=95 and coalesce(cs.last_event_count,0)>0 and cs.last_success_at >= now()-interval '24 hours' then
      new.verification_tier := 'trusted';
      new.verification_score := greatest(coalesce(new.verification_score,0), least(95,cs.reliability_score));
      new.last_verified_at := cs.last_success_at;
      new.content_verified_at := cs.last_success_at;
      new.verification_reasons := coalesce(new.verification_reasons,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('code','official_source_sync_verified','source_id',cs.id,'verified_at',cs.last_success_at));
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.infer_event_is_outdoor(p_place_id uuid, p_title text, p_description text, p_venue_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  place_outdoor boolean;
  place_found boolean := false;
  haystack text := lower(coalesce(p_title,'') || ' ' || coalesce(p_description,'') || ' ' || coalesce(p_venue_name,''));
  venue_text text := lower(coalesce(p_venue_name,''));
begin
  if venue_text ~ E'(library|meeting room|multipurpose room|conference room|classroom|auditorium|community meeting|storytime room|children.?s room|indoor play|recreation center|community center)' then
    return false;
  end if;
  if p_place_id is not null then
    select true, is_outdoor into place_found, place_outdoor from public.places where id=p_place_id;
    if place_found then return coalesce(place_outdoor,false); end if;
  end if;
  if haystack ~ E'\\m(outdoor|outside|playground|park|splash pad|water park|farm|zoo|nature trail|trail walk|hike|hiking|festival|field day|soccer|baseball|softball|football|picnic|riverwalk|waterfront|botanical gardens|garden walk)\\M' then
    return true;
  end if;
  return false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.invalidate_recommendation_cache()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare n integer; begin delete from public.recommendation_response_cache where expires_at>now(); get diagnostics n=row_count; return n; end; $function$
;

CREATE OR REPLACE FUNCTION public.inventory_market_coverage_report(days_ahead integer DEFAULT 14)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_daily jsonb;
  v_sources jsonb;
  v_funnel jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'day',d.day,
    'feed_events',coalesce(f.n,0),
    'outdoor_events',coalesce(f.outdoor,0),
    'indoor_events',coalesce(f.indoor,0),
    'local_events',coalesce(f.local_n,0),
    'target_met',coalesce(f.n,0)>=5
  ) order by d.day),'[]'::jsonb)
  into v_daily
  from generate_series(current_date,current_date+greatest(days_ahead-1,0),'1 day') d(day)
  left join lateral (
    select count(*) n,
           count(*) filter(where fe.is_outdoor=true) outdoor,
           count(*) filter(where fe.is_outdoor=false) indoor,
           count(*) filter(where fe.geography_tier in ('pasco','tampa')) local_n
    from public.feed_events fe
    where (fe.starts_at at time zone 'America/New_York')::date=d.day
      and fe.ends_at>=now()
  ) f on true;

  select jsonb_build_object(
    'active_sources',count(*) filter(where active),
    'never_succeeded',count(*) filter(where active and last_success_at is null),
    'succeeded_7d',count(*) filter(where active and last_success_at>=now()-interval '7 days'),
    'high_priority_active',count(*) filter(where active and greatest(coalesce(discovery_priority,0),coalesce(source_priority,0))>=90),
    'high_priority_never_succeeded',count(*) filter(where active and last_success_at is null and greatest(coalesce(discovery_priority,0),coalesce(source_priority,0))>=90)
  ) into v_sources from public.content_sources;

  select jsonb_build_object(
    'candidates_7d',count(*) filter(where starts_at>=now() and starts_at<now()+interval '7 days'),
    'discovered_7d',count(*) filter(where candidate_status='discovered' and starts_at>=now() and starts_at<now()+interval '7 days'),
    'promoted_7d',count(*) filter(where candidate_status='promoted' and starts_at>=now() and starts_at<now()+interval '7 days'),
    'deferred_7d',count(*) filter(where candidate_status='deferred' and starts_at>=now() and starts_at<now()+interval '7 days'),
    'rejected_7d',count(*) filter(where candidate_status='rejected' and starts_at>=now() and starts_at<now()+interval '7 days')
  ) into v_funnel from public.event_discovery_candidates;

  return jsonb_build_object('daily',v_daily,'sources',v_sources,'funnel',v_funnel,'generated_at',now());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_event_outdoor(p_title text, p_venue_name text, p_description text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select case
   when coalesce(p_title,'')||' '||coalesce(p_venue_name,'')||' '||coalesce(p_description,'') ~* '(indoor|inside|library|museum|aquarium|art studio|play cafe|playtown|gym|gymnastics|trampoline|ice rink|theater|theatre|community center|branch)' then false
   when coalesce(p_title,'')||' '||coalesce(p_venue_name,'')||' '||coalesce(p_description,'') ~* '(outdoor|outside|park|playground|nature|garden|farm|ranch|trail|hike|hiking|splash pad|water play|beach|fishing|soccer|baseball|softball|t-ball|nature walk|storywalk|field day)' then true
   else false
 end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_kid_relevant_event(p_title text, p_venue_name text, p_source text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when coalesce(p_title,'') ~* '(adult[s]? only|18\\+|21\\+|senior[s]?|teen[s]?|tween[s]?|high school|middle school|date night|parents? night out|ladies night|wine|brewery|distillery|nightlife|happy hour|casino|tribute band|adult concert|poison control|clinic|medical|doctor|dentist|dental|orthodont|vaccin|insurance|therapy|counseling|treatment)' then false
    when coalesce(p_title,'') ~* '(council|committee|board|professional development|networking|industry|association meeting|staff meeting|leadership meeting)' and coalesce(p_title,'') !~* '(kids?|children|family|toddler|preschool|baby|infant|storytime|story time|sensory|play|craft)' then false
    when coalesce(p_venue_name,'') ~* '(- Adult|Teen Room|Adult Public Floor)' then false
    when coalesce(p_title,'') ~* '(storytime|story time|lap.?sit|toddler|preschool|baby|babies|infant|sensory|children|child|kids?|pbs kids|family fun|family day|family event|playground|open play|play time|music|dance|gymnastics|swim|splash|water play|farm|petting zoo|zoo|aquarium|museum|library|puppet|theater|theatre|festival|fair|crafts?|arts? ?and crafts|nature|park|play|bounce|trampoline|mommy|parent.?child|little explorers|early learning|early childhood|ingenuity lab|knex|open studio|scratch art|paws ?& ?pages|legos?)' then true
    when coalesce(p_venue_name,'') ~* '(children|kids|toddler|preschool|family|playground|indoor play|trampoline|bounce|zoo|aquarium|farm|children.?s museum|storytime room)' then true
    else false
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_member(g uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.group_members
    where group_id = g
      and user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.join_group_by_code(code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare gid uuid;
begin
  select id into gid from groups where invite_code = code;
  if gid is null then
    raise exception 'Invalid invite code';
  end if;
  insert into group_members (group_id, user_id)
    values (gid, auth.uid())
    on conflict do nothing;
  return gid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.maintain_event_pipeline()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cancelled_stale integer := 0; stale_candidates integer := 0; over_window integer := 0;
begin
  -- Clear "keep" before cancelling so events_keep_requires_published is satisfied.
  update public.events
     set content_status='review', content_review_status='cancelled'
   where starts_at < now() and coalesce(status,'')='published' and content_status='keep';

  update public.events
     set status='cancelled', content_status=coalesce(content_status,'review'), content_review_status='cancelled'
   where starts_at < now() and coalesce(status,'')='published';
  get diagnostics cancelled_stale=row_count;

  update public.event_discovery_candidates
     set status='excluded',content_type='exclude',content_type_confidence=0.999,content_type_reason='maintenance_90_day_window'
   where starts_at>now()+interval '90 days'
     and status not in ('published','excluded')
     and coalesce(candidate_status,'') not in ('promoted','duplicate')
     and promotion_event_id is null;
  get diagnostics over_window=row_count;

  update public.event_discovery_candidates
     set status='excluded',content_type='exclude',content_type_confidence=0.999,content_type_reason='maintenance_past_event'
   where starts_at<now()
     and status not in ('published','excluded')
     and coalesce(candidate_status,'') not in ('promoted','duplicate')
     and promotion_event_id is null;
  get diagnostics stale_candidates=row_count;

  return jsonb_build_object('cancelled_stale_published_events',cancelled_stale,'excluded_over_90_days',over_window,'excluded_stale_candidates',stale_candidates,'ran_at',now());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.materialize_programs(days_ahead integer DEFAULT 60)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p record; d date; dow_token text; made int:=0; local_start timestamptz; v_score integer; v_age_band text; v_geo_tier text;
begin
for p in select rp.*,pl.lat as place_lat,pl.lng as place_lng,pl.latitude as place_latitude,pl.longitude as place_longitude,pl.city as place_city,pl.state as place_state,pl.zip_code as place_zip from public.recurring_programs rp join public.places pl on pl.id=rp.place_id and pl.active and coalesce(pl.lat,pl.latitude) is not null and coalesce(pl.lng,pl.longitude) is not null where rp.active and rp.age_max_months>=0 and rp.age_min_months<=60 loop
 v_score:=case when lower(coalesce(p.source,'')) in ('official venue','tampa firefighters museum','glazer children''s museum') then 95 else 85 end;
 v_age_band:=case when p.age_max_months<=24 then 'baby' when p.age_max_months<=60 then 'toddler' else 'family_0_5' end;
 v_geo_tier:=case when lower(coalesce(p.place_city,''))='tampa' then 'tampa' when lower(coalesce(p.place_city,'')) in ('lutz','land o lakes','wesley chapel','new port richey','hudson','pasco') then 'pasco' else 'far' end;
 d:=current_date;
 while d<=current_date+days_ahead loop
  dow_token:=case extract(dow from d) when 0 then 'SU' when 1 then 'MO' when 2 then 'TU' when 3 then 'WE' when 4 then 'TH' when 5 then 'FR' else 'SA' end;
  if p.rrule like '%'||dow_token||'%' and (p.season_start is null or d>=p.season_start) and (p.season_end is null or d<=p.season_end) then
   local_start:=(d::text||' '||p.start_time::text)::timestamp at time zone 'America/New_York';
   if not exists (select 1 from public.events ce where ce.status in ('published','cancelled') and ce.place_id=p.place_id and ce.program_id is distinct from p.id and ce.starts_at=local_start and lower(trim(coalesce(ce.title,'')))=lower(trim(coalesce(p.title,'')))) then
    insert into public.events (title,description,venue_name,address,lat,lng,location_latitude,location_longitude,location_city,location_state,location_zip,starts_at,ends_at,age_tags,age_min_months,age_max_months,cost,source,source_url,external_id,program_id,registration_required,registration_url,metro_area,last_verified_at,is_kid_relevant,content_status,age_band,geography_tier,content_review_status,content_verified_at,verification_tier,verification_score,verification_reasons,feed_score,status)
    values (p.title,p.description,p.venue_name,p.address,p.place_lat,p.place_lng,p.place_latitude,p.place_longitude,p.place_city,p.place_state,p.place_zip,local_start,local_start+(p.duration_minutes||' minutes')::interval,case when p.age_label is null then '{}'::text[] else array[p.age_label] end,p.age_min_months,p.age_max_months,p.cost,'program',p.source_url,'prog:'||p.id::text||':'||d::text,p.id,p.registration_required,p.registration_url,p.metro_area,p.last_verified_at,true,'keep',v_age_band,v_geo_tier,'auto_approved',p.last_verified_at,case when v_score>=95 then 'trusted' else 'high' end,v_score,'["active_recurring_program","canonical_place","recent_source_verification"]'::jsonb,v_score,'published')
    on conflict (external_id) where program_id is not null and external_id is not null do update set title=excluded.title,description=excluded.description,venue_name=excluded.venue_name,address=excluded.address,starts_at=excluded.starts_at,ends_at=excluded.ends_at,cost=excluded.cost,source='program',source_url=excluded.source_url,last_verified_at=excluded.last_verified_at,is_kid_relevant=true,content_status='keep',age_band=excluded.age_band,geography_tier=excluded.geography_tier,content_review_status='auto_approved',content_verified_at=excluded.content_verified_at,verification_tier=excluded.verification_tier,verification_score=excluded.verification_score,verification_reasons=excluded.verification_reasons,feed_score=excluded.feed_score,status='published';
    made:=made+1;
   end if;
  end if;
  d:=d+1;
 end loop;
end loop;
return made;
end; $function$
;

CREATE OR REPLACE FUNCTION public.merge_safe_event_duplicates()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare c record; keeper uuid; dup uuid; merged_count integer:=0; skipped_count integer:=0; ids uuid[]; begin for c in select * from public.event_duplicate_clusters where status='pending' and confidence>=95 order by created_at loop ids:=c.event_ids; select e.id into keeper from public.events e where e.id=any(ids) and e.status='published' order by e.verification_score desc,e.feed_score desc,e.last_verified_at desc nulls last,e.created_at asc limit 1; if keeper is null then skipped_count:=skipped_count+1; continue; end if; for dup in select x from unnest(ids) as x where x<>keeper loop if exists(select 1 from public.rsvps where event_id=dup) or exists(select 1 from public.event_comments where event_id=dup) or exists(select 1 from public.outing_feedback where event_id=dup) or exists(select 1 from public.place_tips where event_id=dup) then skipped_count:=skipped_count+1; continue; end if; update public.activity_source_records set resolved_event_id=keeper,verification_status=case when verification_status='cancelled' then verification_status else 'verified' end where resolved_event_id=dup; update public.events set duplicate_of_event_id=keeper,duplicate_of=null,status='cancelled',content_status='exclude',is_kid_relevant=false,content_review_status='auto_approved',content_review_reason='Duplicate of canonical event '||keeper::text,content_verified_at=now() where id=dup and status='published'; merged_count:=merged_count+1; end loop; if not exists(select 1 from public.events e where e.id=any(ids) and e.status='published' and e.id<>keeper) then update public.event_duplicate_clusters set status='merged',updated_at=now() where id=c.id; end if; end loop; return jsonb_build_object('merged_events',merged_count,'skipped_events',skipped_count); end; $function$
;

CREATE OR REPLACE FUNCTION public.normalize_crawler_source_health()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if new.last_success_at is distinct from old.last_success_at then if coalesce(new.last_event_count,0)>0 then new.consecutive_zero_yield:=0; else new.consecutive_zero_yield:=coalesce(old.consecutive_zero_yield,0)+1; end if; end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.normalize_dedup_key(title text, venue text, event_date date)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select lower(trim(regexp_replace(coalesce(title, ''), '\s+', ' ', 'g')))
    || '|' || lower(trim(regexp_replace(coalesce(venue, ''), '\s+', ' ', 'g')))
    || '|' || coalesce(event_date::text, '');
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_discovery_run_partial_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare ok_count integer; begin if new.status='failed' and new.error_message ilike '%source failures%' then select count(*) into ok_count from public.content_sync_runs where started_at>=new.started_at and started_at<=coalesce(new.finished_at,now()) and status='success'; if ok_count>0 then new.status='partial'; end if; end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.normalize_discovery_run_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if new.status='failed' and new.finished_at is not null and coalesce(new.events_found,0)>0 and coalesce(new.error_message,'') ilike '%source failures%' then new.status:='partial'; end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.normalize_event_key(p_title text, p_starts_at timestamp with time zone, p_venue text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select lower(regexp_replace(coalesce(p_title,'') || '|' || to_char(p_starts_at at time zone 'America/New_York','YYYY-MM-DD HH24:MI') || '|' || coalesce(p_venue,''), '[^a-zA-Z0-9|]+', '', 'g'));
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_event_text(input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v text := coalesce(input,'');
begin
  v := replace(v,'&lt;','<'); v := replace(v,'&gt;','>'); v := replace(v,'&amp;','&'); v := replace(v,'&quot;','"'); v := replace(v,'&#39;',''''); v := replace(v,'&hellip;','…');
  v := replace(v,chr(92)||'n',' '); v := replace(v,chr(92)||',',','); v := replace(v,chr(92)||'.','.'); v := replace(v,chr(92)||':',':'); v := replace(v,chr(92)||';',';'); v := replace(v,chr(92)||'!','!'); v := replace(v,chr(92)||'?','?');
  v := regexp_replace(v,'<[^>]+>',' ','g');
  v := regexp_replace(v,'\s+',' ','g');
  return nullif(trim(v),'');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_event_text_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.title := public.normalize_event_text(new.title);
  new.description := public.normalize_event_text(new.description);
  new.venue_name := public.normalize_event_text(new.venue_name);
  new.venue_display := public.normalize_event_text(new.venue_display);
  new.organizer := public.normalize_event_text(new.organizer);
  new.room_name := public.normalize_event_text(new.room_name);
  new.address := public.normalize_event_text(new.address);
  new.cost := public.normalize_event_text(new.cost);
  new.display_title := public.normalize_event_text(new.display_title);
  if new.description is not null then
    new.description := regexp_replace(new.description, '<[^>]+>', ' ', 'g');
    new.description := regexp_replace(new.description, E'\\s+', ' ', 'g');
    new.description := nullif(trim(new.description), '');
  end if;
  if new.address is not null then
    new.address := regexp_replace(new.address, E'\\s*-\\s*$', '', 'g');
    new.address := regexp_replace(new.address, E'\\s+', ' ', 'g');
    new.address := nullif(trim(new.address), '');
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_family_candidate_quality()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rel numeric:=0; t text;
begin
  select coalesce(reliability_score,0) into rel from public.content_sources where id=new.source_id;
  t:=lower(coalesce(new.title,'')||' '||coalesce(new.venue_name,''));
  if new.age_band in ('baby','toddler','preschool','family_0_5')
     and t ~ '(storytime|story time|kids?|children|toddler|preschool|baby|babies|infant|sensory|kids open studio|pbs kids|knex|legos?|family play|family day|family resource|resource fair|parent.?child|movie screening.*\\(pg\\))'
     and rel>=90 then
    new.score:=greatest(coalesce(new.score,0),85);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_for_evidence(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select btrim(
    regexp_replace(
      lower(
        translate(
          coalesce(t,''),
          -- curly single/double quotes, en/em dash, nbsp -> ascii equivalents
          E'\u2018\u2019\u201C\u201D\u2013\u2014\u00A0',
          E'''''""--' || ' '
        )
      ),
      '\s+', ' ', 'g'
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_recommendation_context(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select jsonb_build_object('lat',round(p_lat::numeric,3),'lng',round(p_lng::numeric,3),'constraints',coalesce(p_constraints,'{}'::jsonb),'start_at',p_start,'end_at',p_end); $function$
;

CREATE OR REPLACE FUNCTION public.normalize_verified_event_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare st text; rel numeric; begin if new.source_id is not null then select source_type,reliability_score into st,rel from public.content_sources where id=new.source_id; if new.source='discovery' and st in ('structured_web','ical','api') and coalesce(rel,0)>=80 then new.source:=st; end if; end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.parse_activity_intent(p_request text, p_child_age_months integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ with s as (select lower(coalesce(p_request,'')) q), parsed as (select q,p_child_age_months age,case when q like '%indoor%' or q like '%inside%' or q like '%rainy day%' then true when q like '%outdoor%' or q like '%outside%' or q like '%park%' or q like '%playground%' or q like '%splash pad%' or q like '%water play%' then false else null end indoor,case when q like '%free%' or q like '%no cost%' or q like '%no money%' or q like '%without spending%' then 0 else null end budget_max,q like '%changing table%' or q like '%diaper changing%' or q like '%diaper table%' needs_changing_table,q like '%nursing%' or q like '%breastfeed%' or q like '%breast feeding%' or q like '%lactation%' needs_nursing,q like '%stroller%' needs_stroller,q like '%sensory%' or q like '%quiet%' or q like '%low stimulation%' or q like '%not too chaotic%' or q like '%calm%' needs_sensory,substring(q from '(\d+(?:\.\d+)?)\s*(?:miles?|mi)')::double precision max_miles,substring(q from '(\d+)\s*(?:minutes?|mins?)')::integer max_minutes,case when q like '%burn some energy%' or q like '%high energy%' or q like '%run around%' or q like '%get energy out%' or q like '%active%' then 'high_energy' when q like '%calm%' or q like '%quiet%' or q like '%low key%' or q like '%relaxing%' or q like '%not too chaotic%' then 'calm' else null end activity_vibe from s) select jsonb_build_object('child_age_months',age,'indoor',indoor,'budget_max',budget_max,'max_distance_miles',max_miles,'max_drive_minutes',max_minutes,'needs_changing_table',needs_changing_table,'needs_nursing',needs_nursing,'needs_stroller',needs_stroller,'needs_sensory',needs_sensory,'activity_vibe',activity_vibe,'query',p_request) from parsed; $function$
;

CREATE OR REPLACE FUNCTION public.parse_recommendation_time_window(p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$ begin if p_end <= p_start then raise exception 'invalid_time_window'; end if; if p_end-p_start > interval '31 days' then raise exception 'time_window_too_large'; end if; return jsonb_build_object('start_at',p_start,'end_at',p_end,'duration_minutes',extract(epoch from (p_end-p_start))/60); end; $function$
;

CREATE OR REPLACE FUNCTION public.phase1_product_qa_gate()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare feed_count int; dup_count int; missing_geo int; bad_state int; bad_time int; coverage_red int; coverage_yellow int; outdoor_days int;
begin
 select count(*) into feed_count from public.feed_events where starts_at>=now() and starts_at<now()+interval '14 days' and ends_at>=now();
 select count(*) into dup_count from (select coalesce(place_id::text,venue,'') as place_key, lower(regexp_replace(coalesce(title,''),'\\s+',' ','g')) as normalized_title,(starts_at at time zone 'America/New_York')::date as event_date from public.feed_events where starts_at>=now() and starts_at<now()+interval '14 days' and ends_at>=now() group by 1,2,3 having count(*)>1) d;
 select count(*) into missing_geo from public.feed_events where starts_at>=now() and starts_at<now()+interval '14 days' and ends_at>=now() and (lat is null or lng is null);
 select count(*) into bad_state from public.feed_events where starts_at>=now() and starts_at<now()+interval '14 days' and ends_at>=now() and (content_status<>'keep' or status='cancelled');
 select count(*) into bad_time from public.feed_events where starts_at>=now() and starts_at<now()+interval '14 days' and ends_at>=now() and (ends_at<=starts_at or (time_unknown=true and time_precision<>'date_only'));
 select count(*) filter(where status='red'),count(*) filter(where status='yellow') into coverage_red,coverage_yellow from public.market_coverage_slo where market='wesley_chapel_45min' and event_day > (now() at time zone 'America/New_York')::date and event_day < ((now() at time zone 'America/New_York')::date + 14);
 select count(*) into outdoor_days from public.market_coverage_slo where market='wesley_chapel_45min' and event_day > (now() at time zone 'America/New_York')::date and event_day < ((now() at time zone 'America/New_York')::date + 14) and outdoor_count>0;
 return jsonb_build_object('feed_events_14d',feed_count,'duplicate_groups_14d',dup_count,'missing_geo_14d',missing_geo,'feed_state_violations_14d',bad_state,'feed_time_integrity_violations_14d',bad_time,'future_coverage_red_days_13d',coalesce(coverage_red,0),'future_coverage_yellow_days_13d',coalesce(coverage_yellow,0),'days_with_verified_outdoor_inventory_13d',outdoor_days,'pass',(dup_count=0 and missing_geo=0 and bad_state=0 and bad_time=0 and coalesce(coverage_red,0)=0));
end; $function$
;

CREATE OR REPLACE FUNCTION public.place_evidence_supported(p_description text, p_evidence text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when length(public.normalize_for_evidence(p_evidence)) < 8 then false
    else position(
      public.normalize_for_evidence(p_evidence) in public.normalize_for_evidence(p_description)
    ) > 0
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.place_hard_reject_reason(p_name text, p_description text, p_category_tags text[])
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_name ~* '\y(brewery|brewing( co)?|brew ?pub|winery|wine bar|distillery|taproom|nightclub|night club|casino|strip club|adult entertainment|cigar lounge|vape shop|smoke shop|hookah)\y'
      then 'venue name indicates an adult-oriented business type'
    when p_description ~* '\y(21\+|18\+|21 and (up|older)|18 and (up|older)|must be (18|21)|adults[- ]only|no children|no minors|no kids allowed|age[- ]restricted)\y'
      then 'description states an age restriction incompatible with toddlers'
    else null
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.prepare_crawler_due_sources()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer; begin
update public.content_sources s set last_attempted_at=now()-interval '30 days' where s.active=true and coalesce(s.next_crawl_at,now())<=now(); get diagnostics n=row_count; return n; end $function$
;

CREATE OR REPLACE FUNCTION public.promote_comment_to_tip(comment_id uuid, tip_category text DEFAULT 'general'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c        record;
  target   uuid;
  new_tip  uuid;
begin
  select * into c from public.event_comments where id = comment_id;
  if c is null then raise exception 'Comment not found'; end if;
  if not is_member(c.group_id) then raise exception 'Not a member of this group'; end if;

  select place_id into target from public.events where id = c.event_id;

  insert into public.place_tips (place_id, event_id, group_id, user_id, body, category)
  values (target, case when target is null then c.event_id else null end,
          c.group_id, c.user_id, left(c.body, 500), tip_category)
  returning id into new_tip;

  update public.event_comments set promoted_tip_id = new_tip where id = comment_id;
  return new_tip;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.promote_event_discovery_candidate(candidate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.event_discovery_candidates%rowtype; src public.content_sources%rowtype; org_name text; resolved_place_id uuid; resolved_place_lat double precision; resolved_place_lng double precision; existing_event_id uuid; inserted_event_id uuid; normalized_title text; candidate_local_date date; reason_text text; normalized_text text; venue_base text; norm_venue text;
begin
select * into c from public.event_discovery_candidates where id=candidate_id for update; if not found then return jsonb_build_object('outcome','not_found','candidate_id',candidate_id); end if;
if c.candidate_status='promoted' and c.promotion_event_id is not null then return jsonb_build_object('outcome','already_promoted','candidate_id',c.id,'promotion_event_id',c.promotion_event_id); end if;
update public.event_discovery_candidates set candidate_status='enriching',promotion_attempted_at=now(),promotion_error=null where id=c.id;
if nullif(btrim(c.title),'') is null then update public.event_discovery_candidates set candidate_status='deferred',promotion_error='title_required' where id=c.id; return jsonb_build_object('outcome','deferred','reason','title_required','candidate_id',c.id); end if;
if c.starts_at is null then update public.event_discovery_candidates set candidate_status='deferred',promotion_error='trustworthy_starts_at_required' where id=c.id; return jsonb_build_object('outcome','deferred','reason','trustworthy_starts_at_required','candidate_id',c.id); end if;
select * into src from public.content_sources where id=c.source_id and active is distinct from false; if not found then update public.event_discovery_candidates set candidate_status='deferred',promotion_error='resolvable_source_required' where id=c.id; return jsonb_build_object('outcome','deferred','reason','resolvable_source_required','candidate_id',c.id); end if;
if c.status='excluded' or c.age_band='exclude' then update public.event_discovery_candidates set candidate_status='rejected',promotion_error=case when c.status='excluded' then 'candidate_status_excluded' else 'age_band_exclude' end where id=c.id; return jsonb_build_object('outcome','rejected','candidate_id',c.id); end if;
if c.age_band is not null and c.age_band not in ('baby','toddler','preschool','family_0_5','review','exclude') then update public.event_discovery_candidates set candidate_status='rejected',promotion_error='invalid_age_band' where id=c.id; return jsonb_build_object('outcome','rejected','reason','invalid_age_band','candidate_id',c.id); end if;
normalized_text:=lower(coalesce(c.title,'')||' '||coalesce(c.description,'')); if normalized_text ~ '(wedding|adult only|adults only|18\\+|21\\+|nightclub|strip club|bar crawl|bachelor party|bachelorette party|burlesque|porn|erotic|sex party|casino)' then update public.event_discovery_candidates set candidate_status='rejected',promotion_error='obvious_non_family_event' where id=c.id; return jsonb_build_object('outcome','rejected','candidate_id',c.id); end if;
org_name:=null; if c.organizer_id is not null then select name into org_name from public.known_organizers where id=c.organizer_id and active is distinct from false limit 1; end if; if nullif(btrim(org_name),'') is null then org_name:=src.name; end if;
resolved_place_id:=null; resolved_place_lat:=null; resolved_place_lng:=null;
if nullif(btrim(c.address),'') is not null then select p.id,coalesce(p.latitude,p.lat),coalesce(p.longitude,p.lng) into resolved_place_id,resolved_place_lat,resolved_place_lng from public.places p where lower(trim(coalesce(p.address,'')))=lower(trim(c.address)) order by case when lower(trim(coalesce(p.name,'')))=lower(trim(coalesce(c.venue_name,''))) then 0 else 1 end limit 1; end if;
if resolved_place_id is null and nullif(btrim(c.venue_name),'') is not null then select p.id,coalesce(p.latitude,p.lat),coalesce(p.longitude,p.lng) into resolved_place_id,resolved_place_lat,resolved_place_lng from public.places p where lower(trim(coalesce(p.name,'')))=lower(trim(coalesce(c.venue_name,''))) limit 1; end if;
venue_base:=trim(split_part(coalesce(c.venue_name,''),' - ',1)); norm_venue:=regexp_replace(lower(venue_base),'[^a-z0-9]+','','g');
if resolved_place_id is null and norm_venue<>'' then select p.id,coalesce(p.latitude,p.lat),coalesce(p.longitude,p.lng) into resolved_place_id,resolved_place_lat,resolved_place_lng from public.places p where regexp_replace(lower(trim(p.name)),'[^a-z0-9]+','','g')=norm_venue or regexp_replace(lower(trim(p.name)),'[^a-z0-9]+','','g') like norm_venue||'%' or norm_venue like regexp_replace(lower(trim(p.name)),'[^a-z0-9]+','','g')||'%' order by case when regexp_replace(lower(trim(p.name)),'[^a-z0-9]+','','g')=norm_venue then 0 else 1 end limit 1; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'riverview public library%' then resolved_place_lat:=27.8135; resolved_place_lng:=-82.3023; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'brandon regional library%' then resolved_place_lat:=27.9294126; resolved_place_lng:=-82.2883908; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'jimmie b. keel regional library%' then resolved_place_lat:=28.08689; resolved_place_lng:=-82.49202; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'jan kaminis platt regional library%' then resolved_place_lat:=27.90738; resolved_place_lng:=-82.51740; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'robert w. saunders%public library%' then resolved_place_lat:=27.95814; resolved_place_lng:=-82.45078; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'town ''n country regional public library%' then resolved_place_lat:=28.026689; resolved_place_lng:=-82.535039; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'bloomingdale regional public library%' then resolved_place_lat:=27.894407; resolved_place_lng:=-82.252423; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'bruton memorial library%' then resolved_place_lat:=28.018361; resolved_place_lng:=-82.126087; end if;
if resolved_place_lat is null and lower(coalesce(c.venue_name,'')) like 'thonotosassa branch library%' then resolved_place_lat:=28.05765; resolved_place_lng:=-82.29484; end if;
normalized_title:=regexp_replace(lower(trim(coalesce(c.title,''))),'[^a-z0-9]+',' ','g'); candidate_local_date:=(c.starts_at at time zone 'America/New_York')::date;
perform pg_advisory_xact_lock(hashtextextended('discovery-normalized|'||normalized_title||'|'||candidate_local_date::text||'|'||coalesce(resolved_place_id::text,'coords:'||coalesce(resolved_place_lat::text,'')||':'||coalesce(resolved_place_lng::text,'')),0));
if c.external_id is not null then perform pg_advisory_xact_lock(hashtextextended('discovery-external|'||c.source_id::text||'|'||c.external_id,0)); end if;
existing_event_id:=null; if c.external_id is not null then select e.id into existing_event_id from public.events e where e.source_id=c.source_id and e.external_id=c.external_id order by e.id limit 1; end if;
if existing_event_id is null then
  select e.id into existing_event_id from public.events e
  where regexp_replace(lower(trim(coalesce(e.title,''))),'[^a-z0-9]+',' ','g')=normalized_title
    and (e.starts_at at time zone 'America/New_York')::date=candidate_local_date
    and (
      (resolved_place_id is not null and e.place_id=resolved_place_id)
      or (resolved_place_lat is not null and e.lat is not null and e.lng is not null and abs(e.lat-resolved_place_lat)<0.001 and abs(e.lng-resolved_place_lng)<0.001)
      or (resolved_place_id is null and resolved_place_lat is null and lower(trim(coalesce(e.address,'')))=lower(trim(coalesce(c.address,''))) and nullif(btrim(c.address),'') is not null)
    )
  order by coalesce(e.verification_score,0) desc,e.id limit 1;
end if;
if existing_event_id is not null then perform public.reconcile_discovery_duplicate(c.id,existing_event_id); update public.event_discovery_candidates set candidate_status='duplicate',promotion_event_id=existing_event_id,promoted_at=null,promotion_error=null where id=c.id; return jsonb_build_object('outcome','duplicate','candidate_id',c.id,'promotion_event_id',existing_event_id,'reconciled',coalesce(src.reliability_score,0)>=90); end if;
if resolved_place_lat is null or resolved_place_lng is null then update public.event_discovery_candidates set candidate_status='deferred',promotion_error='geography_verification_required' where id=c.id; return jsonb_build_object('outcome','deferred','reason','geography_verification_required','candidate_id',c.id); end if;
insert into public.events(title,description,venue_name,address,starts_at,ends_at,source,source_url,external_id,source_id,place_id,lat,lng,location_latitude,location_longitude,organizer,age_band,is_kid_relevant,content_status,time_precision,event_time_known,time_normalization_note) values(c.title,c.description,c.venue_name,c.address,c.starts_at,c.ends_at,'discovery',c.source_url,c.external_id,c.source_id,resolved_place_id,resolved_place_lat,resolved_place_lng,resolved_place_lat,resolved_place_lng,org_name,c.age_band,c.status is distinct from 'excluded' and c.age_band is distinct from 'exclude','review',case when lower(coalesce(c.reason,'')) like 'date-only listing;%' then 'date_only' else 'exact' end,case when lower(coalesce(c.reason,'')) like 'date-only listing;%' then false else true end,case when lower(coalesce(c.reason,'')) like 'date-only listing;%' then 'Source supplied date only; noon is a placeholder until time is verified.' else null end) returning id into inserted_event_id;
update public.event_discovery_candidates set candidate_status='promoted',promotion_event_id=inserted_event_id,promoted_at=now(),promotion_error=null,idempotency_key=coalesce(idempotency_key,c.id::text) where id=c.id; return jsonb_build_object('outcome','promoted','candidate_id',c.id,'promotion_event_id',inserted_event_id,'canonical_coordinates_used',resolved_place_lat is not null);
exception when others then reason_text:=sqlerrm; update public.event_discovery_candidates set candidate_status='error',promotion_error=reason_text where id=candidate_id; return jsonb_build_object('outcome','error','candidate_id',candidate_id,'error',reason_text,'sqlstate',sqlstate); end;
$function$
;

CREATE OR REPLACE FUNCTION public.propose_event_for_group(p_place_id uuid, p_group_id uuid, p_starts_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user_id uuid:=auth.uid(); v_event_id uuid; v_place record; v_lat double precision; v_lng double precision;
begin
 if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_place_id is null or p_group_id is null or p_starts_at is null then raise exception 'place, group, and start time are required' using errcode='22023'; end if;
 if not exists(select 1 from public.groups g where g.id=p_group_id and (g.created_by=v_user_id or exists(select 1 from public.group_members gm where gm.group_id=g.id and gm.user_id=v_user_id))) then raise exception 'not authorized to propose a meetup for this group' using errcode='42501'; end if;
 select * into v_place from public.places where id=p_place_id and active=true;
 if not found then raise exception 'place not found or inactive' using errcode='22023'; end if;
 v_lat:=coalesce(v_place.lat,v_place.latitude); v_lng:=coalesce(v_place.lng,v_place.longitude);
 if v_lat is null or v_lng is null then raise exception 'place has no verified coordinates' using errcode='22023'; end if;
 insert into public.events(title,venue_name,address,lat,lng,location_latitude,location_longitude,location_city,location_state,location_zip,place_id,proposed_by_group,added_by,starts_at,status,content_status,is_kid_relevant)
 values(v_place.name,v_place.name,v_place.address,v_lat,v_lng,v_lat,v_lng,v_place.city,v_place.state,v_place.zip_code,p_place_id,p_group_id,v_user_id,p_starts_at,'published','keep',true) returning id into v_event_id;
 insert into public.rsvps(event_id,user_id,status)
 values(v_event_id,v_user_id,'going')
 on conflict (event_id,user_id) do update set status='going';
 insert into public.group_proposal_notifications(event_id,group_id,recipient_id)
 select v_event_id,p_group_id,gm.user_id from public.group_members gm where gm.group_id=p_group_id and gm.user_id<>v_user_id on conflict do nothing;
 return v_event_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.publish_discovery_candidates_batch(p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
  evaluation jsonb;
  promotion jsonb;
  evaluated integer := 0;
  promoted integer := 0;
  duplicates integer := 0;
  rejected integer := 0;
  deferred integer := 0;
  errors integer := 0;
  skipped integer := 0;
  results jsonb := '[]'::jsonb;
  batch_limit integer := greatest(1, least(coalesce(p_limit,10),100));
begin
  for r in
    select id
    from public.event_discovery_candidates
    where candidate_status = 'discovered'
    order by discovered_at nulls last, id
    limit batch_limit
  loop
    evaluated := evaluated + 1;
    evaluation := public.evaluate_event_discovery_candidate_shadow(r.id);

    case evaluation->>'outcome'
      when 'error' then
        errors := errors + 1;
        results := results || jsonb_build_array(jsonb_build_object('candidate_id',r.id,'shadow',evaluation,'outcome','error'));
      when 'promote' then
        promotion := public.promote_event_discovery_candidate(r.id);
        case promotion->>'outcome'
          when 'promoted' then promoted := promoted + 1;
          when 'duplicate' then duplicates := duplicates + 1;
          when 'rejected' then rejected := rejected + 1;
          when 'deferred' then deferred := deferred + 1;
          when 'error' then errors := errors + 1;
          else skipped := skipped + 1;
        end case;
        results := results || jsonb_build_array(jsonb_build_object('candidate_id',r.id,'shadow',evaluation,'promotion',promotion));
      when 'duplicate' then
        duplicates := duplicates + 1;
        results := results || jsonb_build_array(jsonb_build_object('candidate_id',r.id,'shadow',evaluation,'outcome','duplicate','promotion_invoked',false));
      when 'reject' then
        rejected := rejected + 1;
        results := results || jsonb_build_array(jsonb_build_object('candidate_id',r.id,'shadow',evaluation,'outcome','reject','promotion_invoked',false));
      when 'defer' then
        deferred := deferred + 1;
        results := results || jsonb_build_array(jsonb_build_object('candidate_id',r.id,'shadow',evaluation,'outcome','defer','promotion_invoked',false));
      when 'not_found' then
        skipped := skipped + 1;
        results := results || jsonb_build_array(jsonb_build_object('candidate_id',r.id,'shadow',evaluation,'outcome','not_found','promotion_invoked',false));
      else
        skipped := skipped + 1;
        results := results || jsonb_build_array(jsonb_build_object('candidate_id',r.id,'shadow',evaluation,'outcome','skipped','promotion_invoked',false));
    end case;
  end loop;
  return jsonb_build_object('batch_limit',batch_limit,'evaluated',evaluated,'promoted',promoted,'duplicates',duplicates,'rejected',rejected,'deferred',deferred,'errors',errors,'skipped',skipped,'results',results);
exception when others then
  return jsonb_build_object('outcome','error','error',SQLERRM,'sqlstate',SQLSTATE,'evaluated',evaluated,'promoted',promoted,'duplicates',duplicates,'rejected',rejected,'deferred',deferred,'errors',errors,'skipped',skipped);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.publish_priority_discovery_candidates_batch(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare r record; evaluation jsonb; promotion jsonb; evaluated int:=0; promoted int:=0; duplicates int:=0; rejected int:=0; deferred int:=0; errors int:=0; begin for r in select c.id from public.event_discovery_candidates c join public.content_sources s on s.id=c.source_id where c.candidate_status='discovered' order by case when s.source_type='structured_web' then 0 when s.source_type='ical' then 1 when s.source_type='api' then 2 when s.source_type='community' then 3 else 4 end, case when c.geography_tier='priority_local' then 0 else 1 end, coalesce(s.reliability_score,0) desc, coalesce(c.confidence,0) desc, c.discovered_at nulls last, c.id limit greatest(1,least(coalesce(p_limit,20),100)) loop evaluated:=evaluated+1; evaluation:=public.evaluate_event_discovery_candidate_shadow(r.id); case evaluation->>'outcome' when 'promote' then promotion:=public.promote_event_discovery_candidate(r.id); if promotion->>'outcome'='promoted' then promoted:=promoted+1; elsif promotion->>'outcome'='duplicate' then duplicates:=duplicates+1; elsif promotion->>'outcome'='rejected' then rejected:=rejected+1; elsif promotion->>'outcome'='deferred' then deferred:=deferred+1; else errors:=errors+1; end if; when 'duplicate' then duplicates:=duplicates+1; when 'reject' then rejected:=rejected+1; when 'defer' then deferred:=deferred+1; else errors:=errors+1; end case; end loop; return jsonb_build_object('evaluated',evaluated,'promoted',promoted,'duplicates',duplicates,'rejected',rejected,'deferred',deferred,'errors',errors); exception when others then return jsonb_build_object('outcome','error','error',SQLERRM,'sqlstate',SQLSTATE,'evaluated',evaluated); end $function$
;

CREATE OR REPLACE FUNCTION public.publish_qualified_discovery_events(p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; n integer:=0; skipped integer:=0;
begin
  for r in
    select e.id,c.id candidate_id
    from public.event_discovery_candidates c
    join public.events e on e.id=c.promotion_event_id
    join public.content_sources s on s.id=c.source_id
    where c.candidate_status='promoted'
      and e.status='published'
      and e.content_status='review'
      and c.age_band in ('baby','toddler','preschool','family_0_5')
      and (
        (coalesce(c.confidence,0)>=0.85 and coalesce(c.score,0)>=80)
        or
        (coalesce(c.confidence,0)>=0.75 and coalesce(c.score,0)>=80
         and s.source_type in ('structured_web','ical','api')
         and coalesce(s.reliability_score,0)>=90)
      )
      and coalesce(c.geography_tier,'unknown') in ('local','priority_local','pasco','tampa')
      and c.starts_at>=now()
      and e.lat is not null and e.lng is not null
      and coalesce(e.event_time_known,false)
    order by c.starts_at
    limit greatest(1,least(coalesce(p_limit,20),100))
  loop
    update public.events
       set content_status='keep',
           verification_score=greatest(coalesce(verification_score,0),85),
           content_verified_at=coalesce(content_verified_at,now())
     where id=r.id;
    if found then n:=n+1; else skipped:=skipped+1; end if;
  end loop;
  return jsonb_build_object('published',n,'skipped',skipped);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rank_recommendation_candidates(p_request_id uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(candidate_id uuid, kind text, rank integer, base_score numeric, learning_bonus numeric, final_score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with c as (
    select candidate_id, coalesce(source_kind, candidate_kind) as kind, score
    from public.recommendation_audit
    where request_id = p_request_id and passed_hard_filters = true
  ),
  l as (
    select candidate_id, coalesce(least(10, positive_count * 2 - negative_count), 0)::numeric as learning_bonus
    from public.recommendation_candidate_learning
  ),
  r as (
    select c.candidate_id, c.kind, c.score as base_score,
           coalesce(l.learning_bonus, 0) as learning_bonus,
           (coalesce(c.score, 0) + coalesce(l.learning_bonus, 0)) as final_score
    from c left join l using(candidate_id)
  )
  select candidate_id, kind,
         row_number() over(order by final_score desc, candidate_id)::integer as rank,
         base_score, learning_bonus, final_score
  from r
  order by final_score desc, candidate_id
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$function$
;

CREATE OR REPLACE FUNCTION public.reactivate_deferred_discovery_candidates()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare n integer; begin update public.event_discovery_candidates c set candidate_status='discovered',status='needs_review',reason='returned to active rolling 90-day window' where c.candidate_status='deferred' and c.starts_at>=now() and c.starts_at<=now()+interval '90 days' and c.reason not like 'date-only listing%' and exists (select 1 from public.content_sources s where s.id=c.source_id and s.active is distinct from false); get diagnostics n=row_count; return n; end $function$
;

CREATE OR REPLACE FUNCTION public.recommendation_cache_key(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select md5(public.normalize_recommendation_context(p_lat,p_lng,p_constraints,p_start,p_end)::text); $function$
;

CREATE OR REPLACE FUNCTION public.recompute_feed_scores()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
 update public.events e set
   feed_score = greatest(0,least(100,
     (case when coalesce(e.is_kid_relevant,false) then 30 else 0 end) +
     (case when coalesce(e.age_max_months,999) <= 72 then 20 else 0 end) +
     (case when coalesce(e.age_min_months,999) <= 36 then 10 else 0 end) +
     (case when coalesce(e.cost,'') ilike '%free%' then 10 else 0 end) +
     (case when coalesce(e.event_time_known,false) then 5 else -5 end) +
     (case when coalesce(e.verification_score,0) >= 70 then 15 when coalesce(e.verification_score,0) >= 50 then 8 else 0 end) +
     (case when coalesce(e.one_time_score,0) >= coalesce(e.recurring_score,0) and coalesce(e.one_time_score,0) >= 60 then 10 else 0 end) +
     (case when lower(coalesce(e.title,'')||' '||coalesce(e.description,'')) ~ '(adult|21\+|18\+|senior|teen|teens|high school|college)' then -35 else 0 end) +
     (case when extract(hour from (e.starts_at at time zone 'America/New_York')) >= 19 then -25 else 0 end)
   )),
   feed_reasons = jsonb_build_array(
     case when coalesce(e.is_kid_relevant,false) then 'kid_relevant' end,
     case when coalesce(e.age_max_months,999) <= 72 then 'age_0_to_5' end,
     case when coalesce(e.cost,'') ilike '%free%' then 'free' end,
     case when coalesce(e.event_time_known,false) then 'time_known' else 'time_unknown' end,
     case when coalesce(e.verification_score,0) >= 70 then 'verified' end,
     case when coalesce(e.one_time_score,0) >= coalesce(e.recurring_score,0) and coalesce(e.one_time_score,0) >= 60 then 'special_one_time' end,
     case when extract(hour from (e.starts_at at time zone 'America/New_York')) >= 19 then 'late_start_penalty' end
   ) - 'null'
 where e.starts_at is not null;
 get diagnostics n = row_count; return n;
end; $function$
;

CREATE OR REPLACE FUNCTION public.recompute_place_evidence_status(p_place_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare src text; ev jsonb; keys text[]; k text; ok_count int:=0; bad_count int:=0; accepted jsonb:='{}'; rejected jsonb:='[]'; begin select description,llm_enrichment_evidence into src,ev from public.places where id=p_place_id and active=true; if src is null then return jsonb_build_object('ok',false,'reason','place_not_found'); end if; ev:=coalesce(ev,'{}'::jsonb); keys:=array(select jsonb_object_keys(ev)); foreach k in array keys loop if public.place_evidence_supported(src,ev->>k) then ok_count:=ok_count+1; accepted:=accepted||jsonb_build_object(k,ev->>k); else bad_count:=bad_count+1; rejected:=rejected||jsonb_build_array(k); end if; end loop; update public.places set llm_verification_status=case when ok_count>0 and bad_count=0 then 'verified' when bad_count>0 then 'needs_review' else 'unverified' end,llm_verified_at=case when ok_count>0 and bad_count=0 then coalesce(llm_verified_at,now()) else null end,llm_last_revalidation=jsonb_build_object('accepted',accepted,'rejected',rejected,'verified',ok_count>0 and bad_count=0,'recomputed_at',now()) where id=p_place_id; return jsonb_build_object('ok',true,'accepted_count',ok_count,'rejected_count',bad_count,'verified',ok_count>0 and bad_count=0); end; $function$
;

CREATE OR REPLACE FUNCTION public.reconcile_discovery_duplicate(p_candidate_id uuid, p_existing_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.event_discovery_candidates%rowtype; s public.content_sources%rowtype; begin
  select * into c from public.event_discovery_candidates where id=p_candidate_id;
  select * into s from public.content_sources where id=c.source_id;
  update public.events e set
    source_id=case when e.source_id is null or coalesce(e.verification_score,0)<80 then c.source_id else e.source_id end,
    source_url=case when e.source_id is null or coalesce(e.verification_score,0)<80 then c.source_url else e.source_url end,
    age_band=case when e.source_id is null or coalesce(e.verification_score,0)<80 then c.age_band else e.age_band end,
    is_kid_relevant=case when e.source_id is null or coalesce(e.verification_score,0)<80 then (c.age_band<>'exclude') else e.is_kid_relevant end,
    lat=case when e.source_id is null or coalesce(e.verification_score,0)<80 then coalesce((select p.latitude from public.places p where p.id=e.place_id),e.lat) else e.lat end,
    lng=case when e.source_id is null or coalesce(e.verification_score,0)<80 then coalesce((select p.longitude from public.places p where p.id=e.place_id),e.lng) else e.lng end,
    verification_score=case when e.source_id is null or coalesce(e.verification_score,0)<80 then greatest(coalesce(e.verification_score,0),85) else e.verification_score end,
    verification_tier=case when e.source_id is null or coalesce(e.verification_score,0)<80 then 'trusted' else e.verification_tier end,
    content_verified_at=case when e.source_id is null or coalesce(e.verification_score,0)<80 then now() else e.content_verified_at end,
    last_verified_at=case when e.source_id is null or coalesce(e.verification_score,0)<80 then now() else e.last_verified_at end
  where e.id=p_existing_event_id and coalesce(s.reliability_score,0)>=90;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reconcile_stuck_discovery_runs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare n integer; begin update public.discovery_runs set status='failed', finished_at=now(), error_message='watchdog: run exceeded 15 minute execution window' where status='running' and started_at < now()-interval '15 minutes'; get diagnostics n = row_count; return n; end; $function$
;

CREATE OR REPLACE FUNCTION public.record_event_pipeline_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare result jsonb; begin result := public.audit_event_pipeline_health(); insert into public.event_pipeline_health_audit_log(health) values(result); return result; end; $function$
;

CREATE OR REPLACE FUNCTION public.record_event_pipeline_observability()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  health jsonb;
  source_row record;
  source_health text;
  reasons jsonb;
  minutes_success numeric;
  minutes_attempt numeric;
  stale_source_count integer := 0;
  critical_alerts integer := 0;
  warning_alerts integer := 0;
begin
  health := public.audit_event_pipeline_health();
  insert into public.event_pipeline_health_audit_log(health) values (health);

  -- Only operational discovery/structured sources that actually participate in
  -- candidate generation are monitored. Raw crawl URLs and archival content
  -- sources are not independent pipeline jobs and must not page operators.
  for source_row in
    select cs.*,
      coalesce((select count(*) from public.event_discovery_candidates c where c.source_id=cs.id),0) as candidate_count,
      coalesce((select count(*) from public.event_discovery_candidates c where c.source_id=cs.id and c.promotion_event_id is not null),0) as promoted_count
    from public.content_sources cs
    where cs.active = true
      and cs.source_type in ('discovery','structured_web','community')
      and exists (select 1 from public.event_discovery_candidates c where c.source_id=cs.id)
  loop
    minutes_success := case when source_row.last_success_at is null then null else extract(epoch from (now()-source_row.last_success_at))/60 end;
    minutes_attempt := case when source_row.last_attempted_at is null then null else extract(epoch from (now()-source_row.last_attempted_at))/60 end;
    reasons := '[]'::jsonb;
    source_health := 'healthy';

    if source_row.last_success_at is null then
      source_health := 'warning';
      reasons := reasons || jsonb_build_array('no_success_recorded');
    elsif source_row.refresh_interval_minutes is not null and minutes_success > greatest(source_row.refresh_interval_minutes * 3, 180) then
      source_health := 'critical';
      reasons := reasons || jsonb_build_array('stale_success');
      stale_source_count := stale_source_count + 1;
    elsif source_row.refresh_interval_minutes is not null and minutes_success > greatest(source_row.refresh_interval_minutes * 1.5, 90) then
      source_health := 'warning';
      reasons := reasons || jsonb_build_array('aging_success');
    end if;

    -- An error is actionable only when the failed attempt is newer than the
    -- latest success. A stale last_error must not poison a healthy source.
    if source_row.last_error is not null
       and source_row.last_attempted_at is not null
       and (source_row.last_success_at is null or source_row.last_attempted_at > source_row.last_success_at) then
      if source_health <> 'critical' then source_health := 'warning'; end if;
      reasons := reasons || jsonb_build_array('latest_attempt_failed');
    end if;

    insert into public.event_pipeline_source_health(
      source_id,source_name,active,refresh_interval_minutes,minutes_since_success,minutes_since_attempt,
      discovery_count,successful_event_count,rejected_event_count,candidate_count,promoted_count,source_error,
      health_status,health_reasons
    ) values (
      source_row.id,source_row.name,source_row.active,source_row.refresh_interval_minutes,minutes_success,minutes_attempt,
      coalesce(source_row.discovery_count,0),coalesce(source_row.successful_event_count,0),coalesce(source_row.rejected_event_count,0),
      source_row.candidate_count,source_row.promoted_count,source_row.last_error,source_health,reasons
    );

    if source_health='critical' then
      insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value,metadata)
      values ('critical','source_stale:'||source_row.id::text,'source',source_row.name||' has not succeeded within its expected refresh window',minutes_success,greatest(coalesce(source_row.refresh_interval_minutes,60)*3,180),jsonb_build_object('source_id',source_row.id))
      on conflict (alert_key) where resolved_at is null do nothing;
      critical_alerts := critical_alerts + 1;
    elsif source_health='warning' then
      insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value,metadata)
      values ('warning','source_warning:'||source_row.id::text,'source',source_row.name||' requires attention',minutes_success,greatest(coalesce(source_row.refresh_interval_minutes,60)*1.5,90),jsonb_build_object('source_id',source_row.id,'reasons',reasons))
      on conflict (alert_key) where resolved_at is null do nothing;
      warning_alerts := warning_alerts + 1;
    else
      update public.event_pipeline_alerts set resolved_at=now() where alert_key in ('source_stale:'||source_row.id::text,'source_warning:'||source_row.id::text) and resolved_at is null;
    end if;
  end loop;

  -- Resolve alerts for sources that are no longer operational discovery inputs.
  update public.event_pipeline_alerts a
  set resolved_at=now()
  where a.resolved_at is null
    and a.component='source'
    and not exists (
      select 1 from public.content_sources cs
      where cs.id=(a.metadata->>'source_id')::uuid
        and cs.active=true
        and cs.source_type in ('discovery','structured_web','community')
        and exists(select 1 from public.event_discovery_candidates c where c.source_id=cs.id)
    );

  if coalesce((health->>'high_confidence_duplicate_clusters_pending')::integer,0) > 0 then
    insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value,metadata)
    values ('critical','duplicates_pending','dedup','High-confidence duplicate clusters are pending',(health->>'high_confidence_duplicate_clusters_pending')::numeric,0,jsonb_build_object('health',health))
    on conflict (alert_key) where resolved_at is null do nothing;
    critical_alerts := critical_alerts + 1;
  else
    update public.event_pipeline_alerts set resolved_at=now() where alert_key='duplicates_pending' and resolved_at is null;
  end if;

  if coalesce((health->>'unsafe_audience_feed_events')::integer,0) > 0 then
    insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value)
    values ('critical','unsafe_feed','feed','Unsafe-audience events are visible to the feed',(health->>'unsafe_audience_feed_events')::numeric,0)
    on conflict (alert_key) where resolved_at is null do nothing;
    critical_alerts := critical_alerts + 1;
  else
    update public.event_pipeline_alerts set resolved_at=now() where alert_key='unsafe_feed' and resolved_at is null;
  end if;

  if coalesce((health->>'negative_duration_events')::integer,0) > 0
     or coalesce((health->>'event_coordinate_drift')::integer,0) > 0
     or coalesce((health->>'place_coordinate_drift')::integer,0) > 0 then
    insert into public.event_pipeline_alerts(severity,alert_key,component,message,metadata)
    values ('critical','integrity_violations','database','One or more event integrity invariants are violated',jsonb_build_object('health',health))
    on conflict (alert_key) where resolved_at is null do nothing;
    critical_alerts := critical_alerts + 1;
  else
    update public.event_pipeline_alerts set resolved_at=now() where alert_key='integrity_violations' and resolved_at is null;
  end if;

  if coalesce((health->>'promotion_attempts')::integer,0) > coalesce((health->>'promotion_links')::integer,0) then
    insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value,metadata)
    values ('warning','promotion_failures','promotion','Promotion attempts exceed successful promotion links',((health->>'promotion_attempts')::numeric-(health->>'promotion_links')::numeric),0,jsonb_build_object('health',health))
    on conflict (alert_key) where resolved_at is null do nothing;
  else
    update public.event_pipeline_alerts set resolved_at=now() where alert_key='promotion_failures' and resolved_at is null;
  end if;

  return jsonb_build_object('checked_at',now(),'health',health,'stale_sources',stale_source_count,'open_critical_alerts',critical_alerts,'open_warning_alerts',warning_alerts);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_recommendation_execution(p_user_id uuid, p_raw_prompt text, p_intent text, p_constraints jsonb, p_candidate_count integer, p_selected_ids uuid[], p_model text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  rid uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.recommendation_requests(user_id, raw_prompt, intent, constraints, candidate_count, selected_ids, model)
  values (
    p_user_id,
    left(p_raw_prompt, 2000),
    left(p_intent, 100)::public.recommendation_intent,
    coalesce(p_constraints, '{}'::jsonb),
    greatest(coalesce(p_candidate_count, 0), 0),
    p_selected_ids,
    p_model
  )
  returning id into rid;

  return rid;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.recover_stuck_content_sync_runs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer; begin
update public.content_sync_runs set status='failed',finished_at=now(),error_message=coalesce(error_message,'watchdog: sync exceeded 15 minute execution window') where status='running' and started_at<now()-interval '15 minutes'; get diagnostics n=row_count; return n; end $function$
;

CREATE OR REPLACE FUNCTION public.recurrence_occurrence_matches(ts timestamp with time zone, rrule text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  local_date date := (ts at time zone 'America/New_York')::date;
  freq text;
  byday text;
  setpos integer;
  target_dow integer;
  first_day date;
  last_day date;
  occurrence integer;
begin
  if rrule is null or rrule = '' then return true; end if;
  freq := substring(rrule from 'FREQ=([^;]+)');
  byday := substring(rrule from 'BYDAY=([^;]+)');
  if freq = 'WEEKLY' and byday is not null then
    target_dow := case upper(byday)
      when 'MO' then 1 when 'TU' then 2 when 'WE' then 3 when 'TH' then 4
      when 'FR' then 5 when 'SA' then 6 when 'SU' then 7 else null end;
    return target_dow is null or extract(isodow from local_date) = target_dow;
  end if;
  if freq = 'MONTHLY' and byday is not null then
    first_day := date_trunc('month', local_date)::date;
    last_day := (first_day + interval '1 month - 1 day')::date;
    if byday ~ '^-[0-9]+(MO|TU|WE|TH|FR|SA|SU)$' then
      setpos := substring(byday from '^(-[0-9]+)')::integer;
      target_dow := case upper(substring(byday from '(MO|TU|WE|TH|FR|SA|SU)$'))
        when 'MO' then 1 when 'TU' then 2 when 'WE' then 3 when 'TH' then 4
        when 'FR' then 5 when 'SA' then 6 when 'SU' then 7 else null end;
      if target_dow is null or extract(isodow from local_date) <> target_dow then return false; end if;
      occurrence := floor((last_day - local_date) / 7)::integer + 1;
      return occurrence = abs(setpos);
    end if;
    if byday ~ '^(MO|TU|WE|TH|FR|SA|SU)$' then
      target_dow := case upper(byday)
        when 'MO' then 1 when 'TU' then 2 when 'WE' then 3 when 'TH' then 4
        when 'FR' then 5 when 'SA' then 6 when 'SU' then 7 else null end;
      setpos := coalesce(substring(rrule from 'BYSETPOS=([0-9-]+)')::integer, 1);
      if target_dow is null or extract(isodow from local_date) <> target_dow then return false; end if;
      occurrence := floor((local_date - first_day) / 7)::integer + 1;
      return occurrence = setpos;
    end if;
  end if;
  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_event_duplicate_clusters()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;
begin
  delete from public.event_duplicate_clusters where status='pending';
  insert into public.event_duplicate_clusters(cluster_key,event_ids,confidence,reason,status)
  select
    md5(
      lower(regexp_replace(trim(title),'[^a-z0-9]+',' ','g'))||'|'||
      date(starts_at at time zone 'America/New_York')||'|'||
      date_trunc('minute',starts_at at time zone 'America/New_York')||'|'||
      coalesce(lower(trim(venue_name)),'')
    ),
    array_agg(id order by verification_score desc,created_at asc),
    95,
    'Same normalized title, local start time, local date, and venue',
    'pending'
  from public.events
  where starts_at >= now() and status='published'
  group by 1
  having count(*) > 1;
  get diagnostics n = row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_event_freshness()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; prev record; sig text; s text; reason text; next_at timestamptz; decay numeric; n integer:=0; due_n integer:=0; stale_n integer:=0; cancelled_n integer:=0; completed_n integer:=0; changed_n integer:=0;
begin
  for r in select e.id,e.starts_at,e.ends_at,e.status,e.content_status,e.created_at,max(a.last_seen_at) source_seen,coalesce(bool_or(a.verification_status='cancelled' or upper(coalesce(a.raw_payload->>'STATUS','')) in ('CANCELLED','CANCELED')),false) source_cancelled,md5(coalesce(string_agg(coalesce(a.external_id,'')||'|'||coalesce(a.raw_payload->>'STATUS','')||'|'||coalesce(a.raw_payload->>'DTSTART','')||'|'||coalesce(a.raw_payload->>'DTEND','')||'|'||coalesce(a.raw_payload->>'SUMMARY',''),'||'),'')) source_signature from events e left join activity_source_records a on a.resolved_event_id=e.id where e.status in ('published','cancelled') group by e.id loop
    select source_signature into prev from event_freshness_state where event_id=r.id; sig:=r.source_signature;
    if r.status='cancelled' then s:='cancelled'; reason:='event_status_cancelled'; next_at:=null; decay:=100; cancelled_n:=cancelled_n+1;
    elsif r.ends_at is not null and r.ends_at < now() then s:='completed'; reason:='event_end_passed'; next_at:=null; decay:=100; completed_n:=completed_n+1;
    elsif r.source_cancelled then s:='cancelled'; reason:='source_record_cancelled'; next_at:=null; decay:=100; cancelled_n:=cancelled_n+1;
    else
      next_at:=case when r.starts_at<=now()+interval '48 hours' then now()+interval '6 hours' when r.starts_at<=now()+interval '7 days' then now()+interval '24 hours' when r.starts_at<=now()+interval '30 days' then now()+interval '3 days' else now()+interval '7 days' end;
      if prev.source_signature is not null and sig is not null and prev.source_signature<>sig then s:='due'; reason:='source_record_changed'; decay:=15; due_n:=due_n+1; changed_n:=changed_n+1;
      elsif r.source_seen is null then s:='due'; reason:='no_source_observation'; decay:=30; due_n:=due_n+1;
      elsif r.source_seen<now()-interval '7 days' then s:='stale'; reason:='source_not_seen_7d'; decay:=60; stale_n:=stale_n+1;
      elsif r.starts_at<=now()+interval '48 hours' and r.source_seen<now()-interval '24 hours' then s:='due'; reason:='near_event_source_verification_due'; decay:=20; due_n:=due_n+1;
      else s:='fresh'; reason:='recent_source_observation'; decay:=0; end if;
      if r.starts_at<now() and r.ends_at is null then s:='completed'; reason:='start_passed_no_end_time'; next_at:=null; decay:=100; completed_n:=completed_n+1; end if;
    end if;
    insert into event_freshness_state(event_id,freshness_state,last_checked_at,last_source_seen_at,last_source_status,next_check_at,stale_since,cancellation_detected_at,completed_at,confidence_decay,reason,source_signature,updated_at) values(r.id,s,now(),r.source_seen,case when r.source_cancelled then 'cancelled' else null end,next_at,case when s='stale' then coalesce((select stale_since from event_freshness_state where event_id=r.id),now()) end,case when s='cancelled' then now() end,case when s='completed' then now() end,decay,reason,sig,now()) on conflict(event_id) do update set freshness_state=excluded.freshness_state,last_checked_at=excluded.last_checked_at,last_source_seen_at=excluded.last_source_seen_at,last_source_status=excluded.last_source_status,next_check_at=excluded.next_check_at,stale_since=case when excluded.freshness_state='stale' then coalesce(event_freshness_state.stale_since,now()) else event_freshness_state.stale_since end,cancellation_detected_at=case when excluded.freshness_state='cancelled' then coalesce(event_freshness_state.cancellation_detected_at,now()) else event_freshness_state.cancellation_detected_at end,completed_at=case when excluded.freshness_state='completed' then coalesce(event_freshness_state.completed_at,now()) else event_freshness_state.completed_at end,confidence_decay=excluded.confidence_decay,reason=excluded.reason,source_signature=excluded.source_signature,updated_at=now();
    insert into event_freshness_checks(event_id,freshness_state,source_seen_at,source_status,reason,next_check_at,source_signature) values(r.id,s,r.source_seen,case when r.source_cancelled then 'cancelled' else null end,reason,next_at,sig);
    if s='cancelled' and r.status='published' then update events set status='cancelled',content_status='exclude',is_kid_relevant=false,content_review_status='auto_approved',content_review_reason='Freshness engine: '||reason,content_verified_at=now() where id=r.id; end if;
    n:=n+1;
  end loop;
  return jsonb_build_object('checked',n,'due',due_n,'stale',stale_n,'cancelled',cancelled_n,'completed',completed_n,'source_changes',changed_n);
end $function$
;

CREATE OR REPLACE FUNCTION public.refresh_event_suppression()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int := 0;
begin
  update public.events e
     set is_suppressed=false,suppressed_reason=null
   where e.is_suppressed=true and e.suppressed_reason='out_of_market'
     and e.lat is not null and e.lng is not null
     and public.distance_km(e.lat,e.lng,28.151123,-82.461479)<=50
     and not exists(select 1 from public.rsvps x where x.event_id=e.id);

  update public.events e
     set is_suppressed=true,suppressed_reason='out_of_market'
   where e.starts_at>=now() and e.is_suppressed=false
     and e.lat is not null and e.lng is not null
     and public.distance_km(e.lat,e.lng,28.151123,-82.461479)>50
     and not exists(select 1 from public.rsvps x where x.event_id=e.id);

  with norm as (
    select id,starts_at,
      lower(regexp_replace(regexp_replace(title,'\\s+at\\s+.*$','','i'),'[^a-z0-9]+',' ','gi')) t,
      lower(split_part(coalesce(venue_name,''),' - ',1)) v,
      case source when 'communico' then 1 when 'discovery' then 2 when 'automated_discovery' then 3 else 4 end pref
    from public.events
    where starts_at>=now() and is_kid_relevant and not is_suppressed and duplicate_of is null
  ),ranked as (
    select id,first_value(id) over(partition by t,v,starts_at order by pref,id) keeper from norm
  )
  update public.events e set duplicate_of=r.keeper,is_suppressed=true,suppressed_reason='duplicate'
    from ranked r where e.id=r.id and r.id<>r.keeper
    and not exists(select 1 from public.rsvps x where x.event_id=e.id);

  -- Only collapse truly date-only records. A record carrying a real clock time
  -- is a legitimate occurrence even when its classifier precision is stale.
  with runs as (
    select id,row_number() over(partition by title,venue_name order by starts_at) rn,
           count(*) over(partition by title,venue_name) total
    from public.events
    where starts_at>=now() and time_precision='date_only'
      and starts_at::time='00:00:00' and not is_suppressed
  )
  update public.events e set is_suppressed=true,suppressed_reason='daily_recurrence_collapsed'
    from runs r where e.id=r.id and r.rn>1 and r.total>=5
    and not exists(select 1 from public.rsvps x where x.event_id=e.id);

  get diagnostics n=row_count;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_fuzzy_event_duplicate_clusters()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  n integer := 0;
  r record;
  k text;
begin
  for r in
    select a.id a_id,b.id b_id,a.title a_title,a.starts_at a_starts_at,a.venue_name a_venue_name,
      extensions.similarity(lower(regexp_replace(a.title,'[^a-z0-9 ]','','g')),lower(regexp_replace(b.title,'[^a-z0-9 ]','','g'))) sim
    from public.events a join public.events b on a.id < b.id
      and a.status='published' and b.status='published'
      and date_trunc('minute',a.starts_at at time zone 'America/New_York')=date_trunc('minute',b.starts_at at time zone 'America/New_York')
      and lower(trim(coalesce(a.venue_name,'')))=lower(trim(coalesce(b.venue_name,'')))
    where extensions.similarity(lower(regexp_replace(a.title,'[^a-z0-9 ]','','g')),lower(regexp_replace(b.title,'[^a-z0-9 ]','','g')))>=0.88
  loop
    k:=md5(lower(regexp_replace(trim(r.a_title),'[^a-z0-9]+',' ','g'))||'|'||date(r.a_starts_at at time zone 'America/New_York')||'|'||date_trunc('minute',r.a_starts_at at time zone 'America/New_York')||'|'||lower(trim(coalesce(r.a_venue_name,''))));
    insert into public.event_duplicate_clusters(cluster_key,event_ids,confidence,reason,status)
    values(k,array[r.a_id,r.b_id],case when r.sim>=0.95 then 95 else 88 end,'Fuzzy title match with same local start time, local date, and venue','pending')
    on conflict(cluster_key) do update set event_ids=excluded.event_ids,confidence=greatest(public.event_duplicate_clusters.confidence,excluded.confidence),reason=case when excluded.confidence>public.event_duplicate_clusters.confidence then excluded.reason else public.event_duplicate_clusters.reason end,updated_at=now();
    n:=n+1;
  end loop;
  return n;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_market_coverage_slo()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r record; n int:=0; begin
  for r in
    select d::date as event_day,
           count(f.id)::int as qualified_count,
           count(f.id) filter(where coalesce(f.is_outdoor,false))::int as outdoor_count,
           count(f.id) filter(where not coalesce(f.is_outdoor,false))::int as indoor_count
    from generate_series(
      greatest((now() at time zone 'America/New_York')::date, (now() at time zone 'America/New_York')::date),
      ((now() at time zone 'America/New_York')::date + 13), interval '1 day'
    ) d
    left join public.feed_events f
      on (f.starts_at at time zone 'America/New_York')::date=d::date
     and f.starts_at>=now() and f.ends_at>=now()
    group by d::date order by d::date
  loop
    insert into public.market_coverage_slo(market,event_day,qualified_count,indoor_count,outdoor_count,target_count,status,evaluated_at)
    values('wesley_chapel_45min',r.event_day,r.qualified_count,r.indoor_count,r.outdoor_count,5,
      case when r.qualified_count>=5 then 'green' when r.qualified_count>=3 then 'yellow' else 'red' end,now())
    on conflict(market,event_day) do update set qualified_count=excluded.qualified_count,indoor_count=excluded.indoor_count,outdoor_count=excluded.outdoor_count,target_count=excluded.target_count,status=excluded.status,evaluated_at=excluded.evaluated_at;
    n:=n+1;
  end loop;
  return jsonb_build_object('days_refreshed',n);
end; $function$
;

CREATE OR REPLACE FUNCTION public.refresh_phase2_quality_feedback()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s record; updated_sources integer:=0; updated_candidates integer:=0;
begin
  for s in select cs.id, coalesce(cs.source_priority,50)::numeric prior,
    count(e.id) filter(where e.status='published' and e.content_status='keep') good_count,
    count(e.id) filter(where e.status='published' and e.content_status='exclude') bad_count,
    count(e.id) filter(where e.duplicate_of_event_id is not null) duplicate_count
    from public.content_sources cs left join public.events e on e.source_id=cs.id and e.created_at>=now()-interval '90 days'
    where cs.active is distinct from false group by cs.id loop
    insert into public.event_source_trust(source_id,prior_score,observed_events,observed_good,observed_bad,observed_duplicate,trust_score,sample_confidence,auto_publish_eligible,updated_at)
    values(s.id,greatest(0,least(100,s.prior)),s.good_count+s.bad_count+s.duplicate_count,s.good_count,s.bad_count,s.duplicate_count,
      greatest(0,least(100,round((s.prior*(20.0/(20+s.good_count+s.bad_count+s.duplicate_count))) + (100.0*s.good_count/greatest(1,s.good_count+s.bad_count+s.duplicate_count))*((s.good_count+s.bad_count+s.duplicate_count)::numeric/(20+s.good_count+s.bad_count+s.duplicate_count)),1))),
      least(1,(s.good_count+s.bad_count+s.duplicate_count)::numeric/20),
      (s.good_count+s.bad_count+s.duplicate_count)>=20 and (100.0*s.good_count/greatest(1,s.good_count+s.bad_count+s.duplicate_count))>=95 and s.duplicate_count=0,
      now())
    on conflict(source_id) do update set prior_score=excluded.prior_score,observed_events=excluded.observed_events,observed_good=excluded.observed_good,observed_bad=excluded.observed_bad,observed_duplicate=excluded.observed_duplicate,trust_score=excluded.trust_score,sample_confidence=excluded.sample_confidence,auto_publish_eligible=excluded.auto_publish_eligible,updated_at=now();
    update public.content_sources cs set reliability_score=round(t.trust_score)::integer,last_quality_update_at=now(),successful_event_count=t.observed_good,rejected_event_count=t.observed_bad,discovery_count=t.observed_events from public.event_source_trust t where cs.id=t.source_id and cs.id=s.id;
    updated_sources:=updated_sources+1;
  end loop;
  insert into public.event_candidate_quality(candidate_id,source_trust,source_sample_confidence,family_relevance,age_confidence,time_confidence,location_confidence,freshness,duplicate_confidence,completeness,quality_score,hard_veto,hard_veto_reason,decision,evaluated_at)
  select c.id,coalesce(t.trust_score,50),coalesce(t.sample_confidence,0),
    case when c.age_band in ('baby','toddler','preschool','family_0_5') then greatest(70,least(100,coalesce(c.content_type_confidence,0))) else greatest(0,coalesce(c.content_type_confidence,0)) end,
    greatest(0,least(100,coalesce(c.content_type_confidence,0))),case when c.starts_at is not null then 100 else 0 end,
    case when nullif(btrim(c.address),'') is not null then 100 when nullif(btrim(c.venue_name),'') is not null then 65 else 0 end,
    greatest(0,least(100,100-(extract(epoch from (now()-c.discovered_at))/86400.0*2))),
    case when exists(select 1 from public.event_duplicate_clusters d where c.id=any(d.event_ids) and d.status='pending') then 0 else 100 end,
    (case when nullif(btrim(c.title),'') is not null then 25 else 0 end+case when c.starts_at is not null then 25 else 0 end+case when nullif(btrim(c.venue_name),'') is not null then 15 else 0 end+case when nullif(btrim(c.address),'') is not null then 15 else 0 end+case when c.age_band is not null then 10 else 0 end+case when nullif(btrim(c.source_url),'') is not null then 10 else 0 end),
    greatest(0,least(100,round(coalesce(t.trust_score,50)*0.20+(case when c.age_band in ('baby','toddler','preschool','family_0_5') then greatest(70,least(100,coalesce(c.content_type_confidence,0))) else greatest(0,coalesce(c.content_type_confidence,0)) end)*0.20+greatest(0,least(100,coalesce(c.content_type_confidence,0)))*0.15+(case when c.starts_at is not null then 100 else 0 end)*0.10+(case when nullif(btrim(c.address),'') is not null then 100 when nullif(btrim(c.venue_name),'') is not null then 65 else 0 end)*0.10+greatest(0,least(100,100-(extract(epoch from (now()-c.discovered_at))/86400.0*2)))*0.10+(case when exists(select 1 from public.event_duplicate_clusters d where c.id=any(d.event_ids) and d.status='pending') then 0 else 100 end)*0.10+(case when nullif(btrim(c.title),'') is not null then 25 else 0 end+case when c.starts_at is not null then 25 else 0 end+case when nullif(btrim(c.venue_name),'') is not null then 15 else 0 end+case when nullif(btrim(c.address),'') is not null then 15 else 0 end+case when c.age_band is not null then 10 else 0 end+case when nullif(btrim(c.source_url),'') is not null then 10 else 0 end)*0.05,1))),
    (c.age_band='exclude' or c.status='excluded' or c.starts_at is null or nullif(btrim(c.title),'') is null or exists(select 1 from public.event_duplicate_clusters d where c.id=any(d.event_ids) and d.status='pending' and d.confidence>=95)),
    case when c.age_band='exclude' then 'age_band_exclude' when c.status='excluded' then 'candidate_excluded' when c.starts_at is null then 'missing_start' when nullif(btrim(c.title),'') is null then 'missing_title' when exists(select 1 from public.event_duplicate_clusters d where c.id=any(d.event_ids) and d.status='pending' and d.confidence>=95) then 'high_confidence_duplicate' else null end,
    case when c.age_band='exclude' or c.status='excluded' or c.starts_at is null or nullif(btrim(c.title),'') is null or exists(select 1 from public.event_duplicate_clusters d where c.id=any(d.event_ids) and d.status='pending' and d.confidence>=95) then 'reject' when coalesce(t.trust_score,50)>=90 and coalesce(t.sample_confidence,0)>=0.5 and c.confidence>=0.9 and coalesce(c.content_type_confidence,0)>=0.9 and c.age_band in ('baby','toddler','preschool','family_0_5') and nullif(btrim(c.address),'') is not null and coalesce(t.auto_publish_eligible,false) then 'auto_publish_candidate' when coalesce(c.confidence,0)>=0.75 then 'promote_review' else 'hold' end,now()
  from public.event_discovery_candidates c left join public.event_source_trust t on t.source_id=c.source_id
  where c.candidate_status in ('discovered','deferred','enriching','promoted','duplicate','rejected','error')
  on conflict(candidate_id) do update set source_trust=excluded.source_trust,source_sample_confidence=excluded.source_sample_confidence,family_relevance=excluded.family_relevance,age_confidence=excluded.age_confidence,time_confidence=excluded.time_confidence,location_confidence=excluded.location_confidence,freshness=excluded.freshness,duplicate_confidence=excluded.duplicate_confidence,completeness=excluded.completeness,quality_score=excluded.quality_score,hard_veto=excluded.hard_veto,hard_veto_reason=excluded.hard_veto_reason,decision=excluded.decision,evaluated_at=now();
  get diagnostics updated_candidates=row_count;
  return jsonb_build_object('sources_updated',updated_sources,'candidates_evaluated',updated_candidates,'evaluated_at',now());
end;$function$
;

CREATE OR REPLACE FUNCTION public.revalidate_places_with_evidence(p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare r record; n int:=0; v int:=0; rv jsonb; begin for r in select id from public.places where active=true and llm_enrichment_evidence is not null order by llm_enriched_at nulls last limit greatest(1,least(coalesce(p_limit,100),500)) loop rv:=public.recompute_place_evidence_status(r.id); n:=n+1; if coalesce((rv->>'verified')::boolean,false) then v:=v+1; end if; end loop; return jsonb_build_object('processed',n,'verified',v); end; $function$
;

CREATE OR REPLACE FUNCTION public.run_discovery_v4_batch4()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  i int;
  locked boolean;
begin
  select pg_try_advisory_lock(hashtextextended('mommas-discovery-v4-batch',0)) into locked;
  if not locked then
    return;
  end if;
  begin
    for i in 1..4 loop
      perform public.prepare_crawler_due_sources();
      perform public.run_discovery_v4_canary();
      if i < 4 then perform pg_sleep(25); end if;
    end loop;
  exception when others then
    perform pg_advisory_unlock(hashtextextended('mommas-discovery-v4-batch',0));
    raise;
  end;
  perform pg_advisory_unlock(hashtextextended('mommas-discovery-v4-batch',0));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.run_discovery_v4_canary()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare rid bigint; begin select net.http_post(url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/discover-local-events-v4', headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')), body := '{}'::jsonb, timeout_milliseconds := 120000) into rid; return rid; end $function$
;

CREATE OR REPLACE FUNCTION public.run_event_reverification_worker()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare request_id bigint;
begin
  select net.http_post(
    url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/reverify-due-events-v1',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret' limit 1)),
    body := '{}'::jsonb
  ) into request_id;
  return request_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.score_organizer_candidate(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o record; s_count integer; score integer;
begin
 select * into o from public.organizer_candidates where id=p_id for update; if not found then return; end if;
 select count(*) into s_count from public.organizer_source_links where organizer_id=p_id and accessible;
 score := least(100, greatest(0, round(o.confidence*45)::int + least(25,s_count*8) + case when lower(o.category) in ('toddler','family','play','swim','pediatric_dentist','chiropractor','community') then 25 else 0 end + case when lower(coalesce(o.locality,'')) ~ '(land o.? lakes|wesley chapel|lutz|trinity)' then 15 else 0 end));
 update public.organizer_candidates set verification_score=score,source_count=s_count,last_verified_at=now(),quality_tier=case when score>=85 then 'trusted' when score>=70 then 'high' when score>=50 then 'medium' when score>=30 then 'low' else 'unverified' end, last_seen_at=now() where id=p_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.score_recommendation_candidate(p_kind text, p_id uuid, p_distance_miles double precision, p_starts_at timestamp with time zone, p_child_age_months integer, p_activity_vibe text DEFAULT NULL::text, p_budget_max numeric DEFAULT NULL::numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select round((case when p_distance_miles is null then 0 else greatest(0,25 - p_distance_miles) end + case when p_starts_at is null then 0 else 20 end + case when p_activity_vibe is null then 10 else 15 end + case when p_budget_max is null then 5 else 10 end)::numeric,2); $function$
;

CREATE OR REPLACE FUNCTION public.search_places(p_term text DEFAULT NULL::text, p_tags text[] DEFAULT NULL::text[], p_limit integer DEFAULT 30)
 RETURNS SETOF places
 LANGUAGE sql
 STABLE
AS $function$
  select p.*
  from public.places p
  where
    (
      p_term is null or btrim(p_term) = '' or
      p.name ilike '%' || p_term || '%' or
      p.description ilike '%' || p_term || '%' or
      p.toddler_notes ilike '%' || p_term || '%' or
      exists (
        select 1 from unnest(p.category_tags) tag
        where tag ilike '%' || p_term || '%'
      )
    )
    and (
      p_tags is null or array_length(p_tags, 1) is null or p.category_tags && p_tags
    )
  order by
    case
      when p_term is not null and p.name ilike p_term then 0
      when p_term is not null and p.name ilike p_term || '%' then 1
      else 2
    end,
    p.discovery_priority desc nulls last,
    p.name asc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$function$
;

CREATE OR REPLACE FUNCTION public.set_candidate_idempotency_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$ begin if new.source_url is not null and new.starts_at is not null and new.title is not null then new.idempotency_key := public.candidate_identity_key(new.source_url,new.starts_at,new.title); end if; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.set_event_setting_from_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if public.infer_event_is_outdoor(new.place_id, new.title, new.description, new.venue_name) then
    new.is_outdoor := true;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.shares_group_with(target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on me.group_id = them.group_id
    where me.user_id = auth.uid()
      and them.user_id = target
  );
$function$
;

CREATE OR REPLACE FUNCTION public.store_recommendation_cache(p_request_hash text, p_user_id uuid, p_request_id uuid, p_response jsonb, p_model text DEFAULT NULL::text, p_ttl_minutes integer DEFAULT 15)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ declare rid uuid; begin insert into public.recommendation_response_cache(request_hash,user_id,request_id,response,model,expires_at) values(p_request_hash,p_user_id,p_request_id,coalesce(p_response,'{}'::jsonb),p_model,now()+make_interval(mins=>greatest(1,least(coalesce(p_ttl_minutes,15),60)))) on conflict(request_hash) do update set response=excluded.response,request_id=excluded.request_id,model=excluded.model,expires_at=excluded.expires_at returning id into rid; return rid; end; $function$
;

CREATE OR REPLACE FUNCTION public.update_source_health_from_sync_run()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare total_found integer; begin total_found:=coalesce(new.discovered_count,0)+coalesce(new.created_count,0)+coalesce(new.updated_count,0); update public.content_sources s set last_event_count=total_found, consecutive_zero_yield=case when new.status='success' and total_found=0 then coalesce(s.consecutive_zero_yield,0)+1 when new.status='success' then 0 else coalesce(s.consecutive_zero_yield,0) end, consecutive_failures=case when new.status in ('failed','error') then coalesce(s.consecutive_failures,0)+1 when new.status='success' then 0 else coalesce(s.consecutive_failures,0) end, last_http_status=case when new.status='success' then 200 else s.last_http_status end, last_error=case when new.status in ('failed','error') then new.error_message when new.status='success' and total_found>0 then null else s.last_error end, updated_at=now() where s.id=new.source_id; return new; end $function$
;

CREATE OR REPLACE FUNCTION public.update_source_reliability(p_source_id uuid, p_outcome text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s record; new_score integer;
begin
 select reliability_score,discovery_count,successful_event_count,rejected_event_count into s from public.content_sources where id=p_source_id for update;
 if not found then return; end if;
 if p_outcome='success' then
   new_score := least(100, coalesce(s.reliability_score,50)+5);
   update public.content_sources set reliability_score=new_score,discovery_count=coalesce(discovery_count,0)+1,successful_event_count=coalesce(successful_event_count,0)+1,last_quality_update_at=now() where id=p_source_id;
 elsif p_outcome='reject' then
   new_score := greatest(0, coalesce(s.reliability_score,50)-3);
   update public.content_sources set reliability_score=new_score,discovery_count=coalesce(discovery_count,0)+1,rejected_event_count=coalesce(rejected_event_count,0)+1,last_quality_update_at=now() where id=p_source_id;
 end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_crawled_place(p_name text, p_address text, p_description text, p_website text, p_source_url text, p_age_min_months integer DEFAULT NULL::integer, p_age_max_months integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
insert into public.places(name,address,metro_area,description,age_min_months,age_max_months,website,source_url,last_verified_at,active)
values(p_name,p_address,'tampa_bay',p_description,p_age_min_months,p_age_max_months,p_website,p_source_url,now(),true)
on conflict(source_url) do update set name=excluded.name,address=excluded.address,description=excluded.description,age_min_months=coalesce(excluded.age_min_months,places.age_min_months),age_max_months=coalesce(excluded.age_max_months,places.age_max_months),website=excluded.website,last_verified_at=now(),active=true
returning id;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_discovery_candidate(p_source_id uuid, p_external_id text, p_title text, p_description text, p_venue_name text, p_address text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_source_url text, p_status text, p_candidate_status text, p_confidence numeric, p_score integer, p_age_band text, p_organizer_id uuid, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_ext text;
  v_key text;
begin
  v_ext := coalesce(nullif(trim(p_external_id),''), md5(coalesce(p_source_url,'')||'|'||coalesce(p_title,'')||'|'||coalesce(p_starts_at::text,'')));
  v_key := md5(lower(regexp_replace(coalesce(p_title,'')||'|'||coalesce(p_venue_name,'')||'|'||coalesce(p_starts_at::text,''),'[^a-zA-Z0-9|]','','g')));

  select id into v_id
  from public.event_discovery_candidates
  where (source_id = p_source_id and external_id = v_ext)
     or idempotency_key = md5(coalesce(p_source_id::text,'')||'|'||v_ext)
     or canonical_key = v_key
  order by case when source_id = p_source_id and external_id = v_ext then 0 else 1 end,
           discovered_at desc
  limit 1;

  if v_id is not null then
    update public.event_discovery_candidates
    set title=left(coalesce(p_title,'Untitled'),1000), description=p_description, venue_name=p_venue_name,
        address=p_address, starts_at=p_starts_at, ends_at=p_ends_at, source_url=p_source_url,
        status=coalesce(p_status,'needs_review'), confidence=p_confidence, reason=p_reason,
        score=greatest(0,least(100,coalesce(p_score,0))), age_band=p_age_band,
        organizer_id=p_organizer_id, canonical_key=v_key, content_type='event',
        content_type_confidence=coalesce(p_confidence,0), content_type_reason=p_reason,
        candidate_status=case when candidate_status in ('promoted','duplicate') then candidate_status else p_candidate_status end,
        idempotency_key=md5(coalesce(p_source_id::text,'')||'|'||v_ext)
    where id=v_id;
    return v_id;
  end if;

  insert into public.event_discovery_candidates(
    source_id,external_id,title,description,venue_name,address,starts_at,ends_at,source_url,discovered_at,
    status,confidence,reason,score,age_band,geography_tier,organizer_id,auto_approved,canonical_key,
    content_type,content_type_confidence,content_type_reason,candidate_status,idempotency_key
  ) values (
    p_source_id,v_ext,left(coalesce(p_title,'Untitled'),1000),p_description,p_venue_name,p_address,p_starts_at,p_ends_at,
    p_source_url,now(),coalesce(p_status,'needs_review'),p_confidence,p_reason,greatest(0,least(100,coalesce(p_score,0))),
    p_age_band,'local',p_organizer_id,false,v_key,'event',coalesce(p_confidence,0),p_reason,p_candidate_status,
    md5(coalesce(p_source_id::text,'')||'|'||v_ext)
  ) returning id into v_id;
  return v_id;
exception when unique_violation then
  select id into v_id
  from public.event_discovery_candidates
  where idempotency_key = md5(coalesce(p_source_id::text,'')||'|'||v_ext)
     or canonical_key = v_key
  order by discovered_at desc limit 1;
  if v_id is null then raise; end if;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_organizer_candidate(p_name text, p_category text, p_locality text, p_website_url text DEFAULT NULL::text, p_discovery_url text DEFAULT NULL::text, p_method text DEFAULT 'search'::text, p_confidence numeric DEFAULT 0.5, p_relevance integer DEFAULT 50)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
 insert into public.organizer_candidates(name,category,locality,website_url,discovery_url,discovery_method,confidence,relevance_score,last_seen_at)
 values(p_name,p_category,p_locality,p_website_url,p_discovery_url,p_method,p_confidence,p_relevance,now())
 on conflict(name,category,locality) do update set website_url=coalesce(excluded.website_url,organizer_candidates.website_url),discovery_url=coalesce(excluded.discovery_url,organizer_candidates.discovery_url),confidence=greatest(organizer_candidates.confidence,excluded.confidence),relevance_score=greatest(organizer_candidates.relevance_score,excluded.relevance_score),last_seen_at=now()
 returning id into v_id;
 return v_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.validate_community_cron_secret(provided_secret text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'mommas_cron_secret'
      and decrypted_secret = provided_secret
  );
$function$
;

CREATE OR REPLACE FUNCTION public.validate_cron_secret(candidate text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'mommas_cron_secret'
      and decrypted_secret = candidate
  );
$function$
;

CREATE OR REPLACE FUNCTION public.validate_recommendation_constraints(p_constraints jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$ declare c jsonb:=coalesce(p_constraints,'{}'::jsonb); max_distance numeric; age_months integer; max_price numeric; indoor boolean; begin max_distance:=case when jsonb_typeof(c->'max_distance_miles')='number' then (c->>'max_distance_miles')::numeric else null end; age_months:=case when jsonb_typeof(c->'child_age_months')='number' then (c->>'child_age_months')::integer else null end; max_price:=case when jsonb_typeof(c->'max_price')='number' then (c->>'max_price')::numeric else null end; indoor:=case when jsonb_typeof(c->'indoor')='boolean' then (c->>'indoor')::boolean else null end; if max_distance is not null and (max_distance<0 or max_distance>100) then return jsonb_build_object('valid',false,'reason','max_distance_miles_out_of_range'); end if; if age_months is not null and (age_months<0 or age_months>216) then return jsonb_build_object('valid',false,'reason','child_age_months_out_of_range'); end if; if max_price is not null and (max_price<0 or max_price>10000) then return jsonb_build_object('valid',false,'reason','max_price_out_of_range'); end if; return jsonb_build_object('valid',true,'normalized',jsonb_strip_nulls(jsonb_build_object('max_distance_miles',max_distance,'child_age_months',age_months,'max_price',max_price,'indoor',indoor))); end; $function$
;

CREATE OR REPLACE FUNCTION public.validate_recommendation_request(p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$ declare c jsonb; t jsonb; begin c:=public.validate_recommendation_constraints(p_constraints); if coalesce((c->>'valid')::boolean,false)=false then return c; end if; begin t:=public.parse_recommendation_time_window(p_start,p_end); exception when others then return jsonb_build_object('valid',false,'reason',sqlerrm); end; return jsonb_build_object('valid',true,'constraints',c->'normalized','time_window',t); end; $function$
;

CREATE OR REPLACE FUNCTION public.who_is_free(target_group uuid, days_ahead integer DEFAULT 14)
 RETURNS TABLE(window_start timestamp with time zone, window_end timestamp with time zone, also_free text[], matching_events jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with mine as (
    select a.id, a.starts_at, a.ends_at
    from public.availability a
    where a.user_id = auth.uid()
      and a.group_id = target_group
      and a.ends_at >= now()
      and a.starts_at <= now() + (days_ahead || ' days')::interval
      and public.is_member(target_group)
  )
  select m.starts_at, m.ends_at,
    coalesce((select array_agg(distinct p.display_name order by p.display_name)
      from public.availability o join public.profiles p on p.id=o.user_id
      where o.group_id=target_group and o.user_id<>auth.uid()
        and o.starts_at < m.ends_at and o.ends_at > m.starts_at), '{}'::text[]),
    coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'title',f.title,'starts_at',f.starts_at,'venue',f.venue,'cost',f.cost) order by f.starts_at)
      from public.feed_events f
      where f.starts_at >= m.starts_at and f.starts_at < m.ends_at
        and (f.proposed_by_group is null or f.proposed_by_group=target_group)), '[]'::jsonb)
  from mine m order by m.starts_at;
$function$
;

-- Function privileges
-- Supabase revokes PUBLIC execute on every new function by default and
-- grants back only specific roles; reproduce that here so a snapshot-
-- bootstrapped project has the same access surface as production (e.g.
-- delete_my_account() must NOT be callable by anon on a fresh project).
revoke all on function public.add_creator_as_member() from public;
grant execute on function public.add_creator_as_member() to authenticated;
grant execute on function public.add_creator_as_member() to service_role;
revoke all on function public.add_organizer_source(p_organizer_id uuid, p_source_url text, p_source_kind text, p_priority integer) from public;
grant execute on function public.add_organizer_source(p_organizer_id uuid, p_source_url text, p_source_kind text, p_priority integer) to service_role;
revoke all on function public.apply_event_enrichment(p_event_id uuid, p_is_kid_relevant boolean, p_age_band text, p_age_min_months integer, p_age_max_months integer, p_experience_type text, p_is_outdoor boolean, p_weather_fit text, p_confidence integer, p_reason text, p_model text) from public;
grant execute on function public.apply_event_enrichment(p_event_id uuid, p_is_kid_relevant boolean, p_age_band text, p_age_min_months integer, p_age_max_months integer, p_experience_type text, p_is_outdoor boolean, p_weather_fit text, p_confidence integer, p_reason text, p_model text) to service_role;
revoke all on function public.apply_local_event_quality_rules() from public;
grant execute on function public.apply_local_event_quality_rules() to service_role;
revoke all on function public.apply_organizer_feedback() from public;
grant execute on function public.apply_organizer_feedback() to service_role;
revoke all on function public.apply_place_enrichment(p_place_id uuid, p_has_changing_table boolean, p_nursing_friendly boolean, p_stroller_accessible boolean, p_quiet_or_sensory_friendly boolean, p_what_to_bring text[], p_price_note text, p_parking_notes text, p_model text) from public;
grant execute on function public.apply_place_enrichment(p_place_id uuid, p_has_changing_table boolean, p_nursing_friendly boolean, p_stroller_accessible boolean, p_quiet_or_sensory_friendly boolean, p_what_to_bring text[], p_price_note text, p_parking_notes text, p_model text) to service_role;
revoke all on function public.apply_place_enrichment_v2(p_place_id uuid, p_claims jsonb, p_model text) from public;
grant execute on function public.apply_place_enrichment_v2(p_place_id uuid, p_claims jsonb, p_model text) to service_role;
revoke all on function public.ask_group_about_event(p_group_id uuid, p_event_id uuid, p_question text) from public;
grant execute on function public.ask_group_about_event(p_group_id uuid, p_event_id uuid, p_question text) to authenticated;
grant execute on function public.ask_group_about_event(p_group_id uuid, p_event_id uuid, p_question text) to service_role;
revoke all on function public.audit_event_pipeline_health() from public;
grant execute on function public.audit_event_pipeline_health() to service_role;
revoke all on function public.auto_approve_discovery_candidates() from public;
grant execute on function public.auto_approve_discovery_candidates() to service_role;
revoke all on function public.cancel_event(target_event uuid, reason text) from public;
grant execute on function public.cancel_event(target_event uuid, reason text) to service_role;
revoke all on function public.candidate_identity_key(p_source_url text, p_starts_at timestamp with time zone, p_title text) from public;
grant execute on function public.candidate_identity_key(p_source_url text, p_starts_at timestamp with time zone, p_title text) to authenticated;
grant execute on function public.candidate_identity_key(p_source_url text, p_starts_at timestamp with time zone, p_title text) to service_role;
revoke all on function public.canonicalize_venue() from public;
grant execute on function public.canonicalize_venue() to authenticated;
grant execute on function public.canonicalize_venue() to service_role;
revoke all on function public.classify_event_content_type() from public;
grant execute on function public.classify_event_content_type() to authenticated;
grant execute on function public.classify_event_content_type() to service_role;
revoke all on function public.clean_venue_text(t text) from public;
grant execute on function public.clean_venue_text(t text) to authenticated;
grant execute on function public.clean_venue_text(t text) to service_role;
revoke all on function public.cleanup_recommendation_cache() from public;
grant execute on function public.cleanup_recommendation_cache() to service_role;
revoke all on function public.cleanup_recommendation_response_cache() from public;
grant execute on function public.cleanup_recommendation_response_cache() to service_role;
revoke all on function public.crawler_canary_assertions() from public;
grant execute on function public.crawler_canary_assertions() to service_role;
revoke all on function public.crawler_record_source_result(p_source_id uuid, p_success boolean, p_yield integer, p_http_status integer, p_duration_ms integer, p_error text) from public;
grant execute on function public.crawler_record_source_result(p_source_id uuid, p_success boolean, p_yield integer, p_http_status integer, p_duration_ms integer, p_error text) to service_role;
revoke all on function public.crawler_source_health() from public;
grant execute on function public.crawler_source_health() to service_role;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.delete_my_account() to service_role;
revoke all on function public.discover_places(p_user_id uuid, p_category text, p_indoor text, p_max_distance_miles numeric, p_limit integer) from public;
grant execute on function public.discover_places(p_user_id uuid, p_category text, p_indoor text, p_max_distance_miles numeric, p_limit integer) to authenticated;
grant execute on function public.discover_places(p_user_id uuid, p_category text, p_indoor text, p_max_distance_miles numeric, p_limit integer) to service_role;
revoke all on function public.discovery_coverage_report() from public;
grant execute on function public.discovery_coverage_report() to service_role;
revoke all on function public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) from public;
grant execute on function public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) to authenticated;
grant execute on function public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision) to service_role;
revoke all on function public.enforce_candidate_promotion_safety() from public;
grant execute on function public.enforce_candidate_promotion_safety() to service_role;
revoke all on function public.enforce_candidate_safety_filters() from public;
grant execute on function public.enforce_candidate_safety_filters() to service_role;
revoke all on function public.enforce_crawler_next_crawl() from public;
grant execute on function public.enforce_crawler_next_crawl() to authenticated;
grant execute on function public.enforce_crawler_next_crawl() to service_role;
revoke all on function public.enforce_crawler_next_crawl_schedule() from public;
grant execute on function public.enforce_crawler_next_crawl_schedule() to service_role;
revoke all on function public.enforce_crawler_source_admission() from public;
grant execute on function public.enforce_crawler_source_admission() to service_role;
revoke all on function public.enforce_discovery_candidate_safety() from public;
grant execute on function public.enforce_discovery_candidate_safety() to service_role;
revoke all on function public.enforce_discovery_promotion_readiness() from public;
grant execute on function public.enforce_discovery_promotion_readiness() to service_role;
revoke all on function public.enforce_event_freshness_publish_guard() from public;
grant execute on function public.enforce_event_freshness_publish_guard() to authenticated;
grant execute on function public.enforce_event_freshness_publish_guard() to service_role;
revoke all on function public.enforce_event_publication_safety() from public;
grant execute on function public.enforce_event_publication_safety() to service_role;
revoke all on function public.enforce_verified_feed_gate() from public;
grant execute on function public.enforce_verified_feed_gate() to service_role;
revoke all on function public.evaluate_event_discovery_candidate_shadow(p_candidate_id uuid) from public;
grant execute on function public.evaluate_event_discovery_candidate_shadow(p_candidate_id uuid) to service_role;
revoke all on function public.event_local_hour(ts timestamp with time zone) from public;
grant execute on function public.event_local_hour(ts timestamp with time zone) to authenticated;
grant execute on function public.event_local_hour(ts timestamp with time zone) to service_role;
revoke all on function public.execute_recommendation_request(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone, p_limit integer) from public;
grant execute on function public.execute_recommendation_request(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone, p_limit integer) to service_role;
revoke all on function public.filter_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_limit integer) from public;
grant execute on function public.filter_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_limit integer) to service_role;
revoke all on function public.get_cached_recommendation(p_request_hash text) from public;
grant execute on function public.get_cached_recommendation(p_request_hash text) to service_role;
revoke all on function public.get_events_for_enrichment(p_limit integer) from public;
grant execute on function public.get_events_for_enrichment(p_limit integer) to service_role;
revoke all on function public.get_freshness_queue(limit_count integer) from public;
grant execute on function public.get_freshness_queue(limit_count integer) to service_role;
revoke all on function public.get_gemini_key() from public;
grant execute on function public.get_gemini_key() to service_role;
revoke all on function public.get_places_for_enrichment(p_limit integer) from public;
grant execute on function public.get_places_for_enrichment(p_limit integer) to service_role;
revoke all on function public.get_places_for_revalidation(p_limit integer) from public;
grant execute on function public.get_places_for_revalidation(p_limit integer) to service_role;
revoke all on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_limit integer) from public;
grant execute on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_limit integer) to service_role;
revoke all on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_limit integer) from public;
grant execute on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_limit integer) to service_role;
revoke all on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_limit integer, p_start timestamp with time zone, p_end timestamp with time zone) from public;
grant execute on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_limit integer, p_start timestamp with time zone, p_end timestamp with time zone) to service_role;
revoke all on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_needs_changing_table boolean, p_needs_nursing_friendly boolean, p_needs_stroller_accessible boolean, p_needs_quiet_or_sensory_friendly boolean, p_limit integer) from public;
grant execute on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_needs_changing_table boolean, p_needs_nursing_friendly boolean, p_needs_stroller_accessible boolean, p_needs_quiet_or_sensory_friendly boolean, p_limit integer) to service_role;
revoke all on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_needs_changing_table boolean, p_needs_nursing_friendly boolean, p_needs_stroller_accessible boolean, p_needs_quiet_or_sensory_friendly boolean, p_budget_max numeric, p_limit integer) from public;
grant execute on function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision, p_child_age_months integer, p_indoor boolean, p_needs_changing_table boolean, p_needs_nursing_friendly boolean, p_needs_stroller_accessible boolean, p_needs_quiet_or_sensory_friendly boolean, p_budget_max numeric, p_limit integer) to service_role;
revoke all on function public.get_recommendation_learning_summary(p_candidate_id uuid) from public;
grant execute on function public.get_recommendation_learning_summary(p_candidate_id uuid) to service_role;
revoke all on function public.guard_recurring_event_occurrence() from public;
grant execute on function public.guard_recurring_event_occurrence() to authenticated;
grant execute on function public.guard_recurring_event_occurrence() to service_role;
revoke all on function public.guard_source_verification() from public;
grant execute on function public.guard_source_verification() to authenticated;
grant execute on function public.guard_source_verification() to service_role;
revoke all on function public.handle_new_user() from public;
grant execute on function public.handle_new_user() to service_role;
revoke all on function public.infer_event_is_outdoor(p_place_id uuid, p_title text, p_description text, p_venue_name text) from public;
grant execute on function public.infer_event_is_outdoor(p_place_id uuid, p_title text, p_description text, p_venue_name text) to authenticated;
grant execute on function public.infer_event_is_outdoor(p_place_id uuid, p_title text, p_description text, p_venue_name text) to service_role;
revoke all on function public.invalidate_recommendation_cache() from public;
grant execute on function public.invalidate_recommendation_cache() to service_role;
revoke all on function public.inventory_market_coverage_report(days_ahead integer) from public;
grant execute on function public.inventory_market_coverage_report(days_ahead integer) to service_role;
revoke all on function public.is_event_outdoor(p_title text, p_venue_name text, p_description text) from public;
grant execute on function public.is_event_outdoor(p_title text, p_venue_name text, p_description text) to authenticated;
grant execute on function public.is_event_outdoor(p_title text, p_venue_name text, p_description text) to service_role;
revoke all on function public.is_kid_relevant_event(p_title text, p_venue_name text, p_source text) from public;
grant execute on function public.is_kid_relevant_event(p_title text, p_venue_name text, p_source text) to authenticated;
grant execute on function public.is_kid_relevant_event(p_title text, p_venue_name text, p_source text) to service_role;
revoke all on function public.is_member(g uuid) from public;
grant execute on function public.is_member(g uuid) to authenticated;
grant execute on function public.is_member(g uuid) to service_role;
revoke all on function public.join_group_by_code(code text) from public;
grant execute on function public.join_group_by_code(code text) to service_role;
revoke all on function public.maintain_event_pipeline() from public;
grant execute on function public.maintain_event_pipeline() to service_role;
revoke all on function public.materialize_programs(days_ahead integer) from public;
grant execute on function public.materialize_programs(days_ahead integer) to service_role;
revoke all on function public.merge_safe_event_duplicates() from public;
grant execute on function public.merge_safe_event_duplicates() to service_role;
revoke all on function public.normalize_crawler_source_health() from public;
grant execute on function public.normalize_crawler_source_health() to service_role;
revoke all on function public.normalize_dedup_key(title text, venue text, event_date date) from public;
grant execute on function public.normalize_dedup_key(title text, venue text, event_date date) to authenticated;
grant execute on function public.normalize_dedup_key(title text, venue text, event_date date) to service_role;
revoke all on function public.normalize_discovery_run_partial_status() from public;
grant execute on function public.normalize_discovery_run_partial_status() to service_role;
revoke all on function public.normalize_discovery_run_status() from public;
grant execute on function public.normalize_discovery_run_status() to service_role;
revoke all on function public.normalize_event_key(p_title text, p_starts_at timestamp with time zone, p_venue text) from public;
grant execute on function public.normalize_event_key(p_title text, p_starts_at timestamp with time zone, p_venue text) to authenticated;
grant execute on function public.normalize_event_key(p_title text, p_starts_at timestamp with time zone, p_venue text) to service_role;
revoke all on function public.normalize_event_text(input text) from public;
grant execute on function public.normalize_event_text(input text) to authenticated;
grant execute on function public.normalize_event_text(input text) to service_role;
revoke all on function public.normalize_event_text_fields() from public;
grant execute on function public.normalize_event_text_fields() to authenticated;
grant execute on function public.normalize_event_text_fields() to service_role;
revoke all on function public.normalize_family_candidate_quality() from public;
grant execute on function public.normalize_family_candidate_quality() to service_role;
revoke all on function public.normalize_for_evidence(t text) from public;
grant execute on function public.normalize_for_evidence(t text) to authenticated;
grant execute on function public.normalize_for_evidence(t text) to service_role;
revoke all on function public.normalize_recommendation_context(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) from public;
grant execute on function public.normalize_recommendation_context(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) to authenticated;
grant execute on function public.normalize_recommendation_context(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) to service_role;
revoke all on function public.normalize_verified_event_source() from public;
grant execute on function public.normalize_verified_event_source() to service_role;
revoke all on function public.parse_activity_intent(p_request text, p_child_age_months integer) from public;
grant execute on function public.parse_activity_intent(p_request text, p_child_age_months integer) to authenticated;
grant execute on function public.parse_activity_intent(p_request text, p_child_age_months integer) to service_role;
revoke all on function public.parse_recommendation_time_window(p_start timestamp with time zone, p_end timestamp with time zone) from public;
grant execute on function public.parse_recommendation_time_window(p_start timestamp with time zone, p_end timestamp with time zone) to authenticated;
grant execute on function public.parse_recommendation_time_window(p_start timestamp with time zone, p_end timestamp with time zone) to service_role;
revoke all on function public.phase1_product_qa_gate() from public;
grant execute on function public.phase1_product_qa_gate() to service_role;
revoke all on function public.place_evidence_supported(p_description text, p_evidence text) from public;
grant execute on function public.place_evidence_supported(p_description text, p_evidence text) to authenticated;
grant execute on function public.place_evidence_supported(p_description text, p_evidence text) to service_role;
revoke all on function public.prepare_crawler_due_sources() from public;
grant execute on function public.prepare_crawler_due_sources() to service_role;
revoke all on function public.promote_comment_to_tip(comment_id uuid, tip_category text) from public;
grant execute on function public.promote_comment_to_tip(comment_id uuid, tip_category text) to service_role;
revoke all on function public.promote_event_discovery_candidate(candidate_id uuid) from public;
grant execute on function public.promote_event_discovery_candidate(candidate_id uuid) to service_role;
revoke all on function public.propose_event_for_group(p_place_id uuid, p_group_id uuid, p_starts_at timestamp with time zone) from public;
grant execute on function public.propose_event_for_group(p_place_id uuid, p_group_id uuid, p_starts_at timestamp with time zone) to authenticated;
grant execute on function public.propose_event_for_group(p_place_id uuid, p_group_id uuid, p_starts_at timestamp with time zone) to service_role;
revoke all on function public.publish_discovery_candidates_batch(p_limit integer) from public;
grant execute on function public.publish_discovery_candidates_batch(p_limit integer) to service_role;
revoke all on function public.publish_priority_discovery_candidates_batch(p_limit integer) from public;
grant execute on function public.publish_priority_discovery_candidates_batch(p_limit integer) to service_role;
revoke all on function public.publish_qualified_discovery_events(p_limit integer) from public;
grant execute on function public.publish_qualified_discovery_events(p_limit integer) to service_role;
revoke all on function public.rank_recommendation_candidates(p_request_id uuid, p_limit integer) from public;
grant execute on function public.rank_recommendation_candidates(p_request_id uuid, p_limit integer) to service_role;
revoke all on function public.reactivate_deferred_discovery_candidates() from public;
grant execute on function public.reactivate_deferred_discovery_candidates() to service_role;
revoke all on function public.recommendation_cache_key(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) from public;
grant execute on function public.recommendation_cache_key(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) to authenticated;
grant execute on function public.recommendation_cache_key(p_lat double precision, p_lng double precision, p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) to service_role;
revoke all on function public.recompute_feed_scores() from public;
grant execute on function public.recompute_feed_scores() to service_role;
revoke all on function public.recompute_place_evidence_status(p_place_id uuid) from public;
grant execute on function public.recompute_place_evidence_status(p_place_id uuid) to service_role;
revoke all on function public.reconcile_discovery_duplicate(p_candidate_id uuid, p_existing_event_id uuid) from public;
grant execute on function public.reconcile_discovery_duplicate(p_candidate_id uuid, p_existing_event_id uuid) to service_role;
revoke all on function public.reconcile_stuck_discovery_runs() from public;
grant execute on function public.reconcile_stuck_discovery_runs() to service_role;
revoke all on function public.record_event_pipeline_health() from public;
grant execute on function public.record_event_pipeline_health() to service_role;
revoke all on function public.record_event_pipeline_observability() from public;
grant execute on function public.record_event_pipeline_observability() to service_role;
revoke all on function public.record_recommendation_execution(p_user_id uuid, p_raw_prompt text, p_intent text, p_constraints jsonb, p_candidate_count integer, p_selected_ids uuid[], p_model text) from public;
grant execute on function public.record_recommendation_execution(p_user_id uuid, p_raw_prompt text, p_intent text, p_constraints jsonb, p_candidate_count integer, p_selected_ids uuid[], p_model text) to authenticated;
grant execute on function public.record_recommendation_execution(p_user_id uuid, p_raw_prompt text, p_intent text, p_constraints jsonb, p_candidate_count integer, p_selected_ids uuid[], p_model text) to service_role;
revoke all on function public.recover_stuck_content_sync_runs() from public;
grant execute on function public.recover_stuck_content_sync_runs() to service_role;
revoke all on function public.recurrence_occurrence_matches(ts timestamp with time zone, rrule text) from public;
grant execute on function public.recurrence_occurrence_matches(ts timestamp with time zone, rrule text) to authenticated;
grant execute on function public.recurrence_occurrence_matches(ts timestamp with time zone, rrule text) to service_role;
revoke all on function public.refresh_event_duplicate_clusters() from public;
grant execute on function public.refresh_event_duplicate_clusters() to service_role;
revoke all on function public.refresh_event_freshness() from public;
grant execute on function public.refresh_event_freshness() to service_role;
revoke all on function public.refresh_event_suppression() from public;
grant execute on function public.refresh_event_suppression() to service_role;
revoke all on function public.refresh_fuzzy_event_duplicate_clusters() from public;
grant execute on function public.refresh_fuzzy_event_duplicate_clusters() to service_role;
revoke all on function public.refresh_market_coverage_slo() from public;
grant execute on function public.refresh_market_coverage_slo() to service_role;
revoke all on function public.refresh_phase2_quality_feedback() from public;
grant execute on function public.refresh_phase2_quality_feedback() to service_role;
revoke all on function public.revalidate_places_with_evidence(p_limit integer) from public;
grant execute on function public.revalidate_places_with_evidence(p_limit integer) to service_role;
revoke all on function public.run_discovery_v4_batch4() from public;
grant execute on function public.run_discovery_v4_batch4() to service_role;
revoke all on function public.run_discovery_v4_canary() from public;
grant execute on function public.run_discovery_v4_canary() to service_role;
revoke all on function public.run_event_reverification_worker() from public;
grant execute on function public.run_event_reverification_worker() to service_role;
revoke all on function public.score_organizer_candidate(p_id uuid) from public;
grant execute on function public.score_organizer_candidate(p_id uuid) to service_role;
revoke all on function public.score_recommendation_candidate(p_kind text, p_id uuid, p_distance_miles double precision, p_starts_at timestamp with time zone, p_child_age_months integer, p_activity_vibe text, p_budget_max numeric) from public;
grant execute on function public.score_recommendation_candidate(p_kind text, p_id uuid, p_distance_miles double precision, p_starts_at timestamp with time zone, p_child_age_months integer, p_activity_vibe text, p_budget_max numeric) to service_role;
revoke all on function public.search_places(p_term text, p_tags text[], p_limit integer) from public;
grant execute on function public.search_places(p_term text, p_tags text[], p_limit integer) to authenticated;
grant execute on function public.search_places(p_term text, p_tags text[], p_limit integer) to service_role;
revoke all on function public.set_candidate_idempotency_key() from public;
grant execute on function public.set_candidate_idempotency_key() to authenticated;
grant execute on function public.set_candidate_idempotency_key() to service_role;
revoke all on function public.set_event_setting_from_context() from public;
grant execute on function public.set_event_setting_from_context() to service_role;
revoke all on function public.shares_group_with(target uuid) from public;
grant execute on function public.shares_group_with(target uuid) to authenticated;
grant execute on function public.shares_group_with(target uuid) to service_role;
revoke all on function public.store_recommendation_cache(p_request_hash text, p_user_id uuid, p_request_id uuid, p_response jsonb, p_model text, p_ttl_minutes integer) from public;
grant execute on function public.store_recommendation_cache(p_request_hash text, p_user_id uuid, p_request_id uuid, p_response jsonb, p_model text, p_ttl_minutes integer) to service_role;
revoke all on function public.update_source_health_from_sync_run() from public;
grant execute on function public.update_source_health_from_sync_run() to service_role;
revoke all on function public.update_source_reliability(p_source_id uuid, p_outcome text) from public;
grant execute on function public.update_source_reliability(p_source_id uuid, p_outcome text) to service_role;
revoke all on function public.upsert_crawled_place(p_name text, p_address text, p_description text, p_website text, p_source_url text, p_age_min_months integer, p_age_max_months integer) from public;
grant execute on function public.upsert_crawled_place(p_name text, p_address text, p_description text, p_website text, p_source_url text, p_age_min_months integer, p_age_max_months integer) to service_role;
revoke all on function public.upsert_discovery_candidate(p_source_id uuid, p_external_id text, p_title text, p_description text, p_venue_name text, p_address text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_source_url text, p_status text, p_candidate_status text, p_confidence numeric, p_score integer, p_age_band text, p_organizer_id uuid, p_reason text) from public;
grant execute on function public.upsert_discovery_candidate(p_source_id uuid, p_external_id text, p_title text, p_description text, p_venue_name text, p_address text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_source_url text, p_status text, p_candidate_status text, p_confidence numeric, p_score integer, p_age_band text, p_organizer_id uuid, p_reason text) to service_role;
revoke all on function public.upsert_organizer_candidate(p_name text, p_category text, p_locality text, p_website_url text, p_discovery_url text, p_method text, p_confidence numeric, p_relevance integer) from public;
grant execute on function public.upsert_organizer_candidate(p_name text, p_category text, p_locality text, p_website_url text, p_discovery_url text, p_method text, p_confidence numeric, p_relevance integer) to service_role;
revoke all on function public.validate_community_cron_secret(provided_secret text) from public;
grant execute on function public.validate_community_cron_secret(provided_secret text) to service_role;
revoke all on function public.validate_cron_secret(candidate text) from public;
grant execute on function public.validate_cron_secret(candidate text) to service_role;
revoke all on function public.validate_recommendation_constraints(p_constraints jsonb) from public;
grant execute on function public.validate_recommendation_constraints(p_constraints jsonb) to authenticated;
grant execute on function public.validate_recommendation_constraints(p_constraints jsonb) to service_role;
revoke all on function public.validate_recommendation_request(p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) from public;
grant execute on function public.validate_recommendation_request(p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) to authenticated;
grant execute on function public.validate_recommendation_request(p_constraints jsonb, p_start timestamp with time zone, p_end timestamp with time zone) to service_role;
revoke all on function public.who_is_free(target_group uuid, days_ahead integer) from public;
grant execute on function public.who_is_free(target_group uuid, days_ahead integer) to service_role;

-- Views
create view public."event_pipeline_command_center" as
 SELECT now() AS checked_at,
    ( SELECT event_pipeline_health_audit_log.health
           FROM event_pipeline_health_audit_log
          ORDER BY event_pipeline_health_audit_log.checked_at DESC
         LIMIT 1) AS latest_health,
    ( SELECT count(*) AS count
           FROM event_pipeline_alerts
          WHERE event_pipeline_alerts.resolved_at IS NULL AND event_pipeline_alerts.severity = 'critical'::text) AS open_critical_alerts,
    ( SELECT count(*) AS count
           FROM event_pipeline_alerts
          WHERE event_pipeline_alerts.resolved_at IS NULL AND event_pipeline_alerts.severity = 'warning'::text) AS open_warning_alerts,
    ( SELECT count(*) AS count
           FROM event_pipeline_source_health
          WHERE event_pipeline_source_health.checked_at = (( SELECT max(event_pipeline_source_health_1.checked_at) AS max
                   FROM event_pipeline_source_health event_pipeline_source_health_1)) AND event_pipeline_source_health.health_status = 'critical'::text) AS critical_sources,
    ( SELECT count(*) AS count
           FROM event_pipeline_source_health
          WHERE event_pipeline_source_health.checked_at = (( SELECT max(event_pipeline_source_health_1.checked_at) AS max
                   FROM event_pipeline_source_health event_pipeline_source_health_1)) AND event_pipeline_source_health.health_status = 'warning'::text) AS warning_sources,
    ( SELECT count(*) AS count
           FROM event_pipeline_source_health
          WHERE event_pipeline_source_health.checked_at = (( SELECT max(event_pipeline_source_health_1.checked_at) AS max
                   FROM event_pipeline_source_health event_pipeline_source_health_1))) AS active_sources;

create view public."feed_events" with (security_invoker=true) as
 SELECT e.id,
    COALESCE(e.display_title, e.title) AS title,
    e.description,
    COALESCE(e.venue_display, e.organizer, e.venue_name) AS venue,
    e.room_name,
    e.organizer,
    e.address,
        CASE
            WHEN e.source_id = 'd8372c79-9c12-41fb-b79d-39118b5478b2'::uuid AND e.place_id IS NULL THEN NULL::double precision
            ELSE COALESCE(e.lat, e.location_latitude)
        END AS lat,
        CASE
            WHEN e.source_id = 'd8372c79-9c12-41fb-b79d-39118b5478b2'::uuid AND e.place_id IS NULL THEN NULL::double precision
            ELSE COALESCE(e.lng, e.location_longitude)
        END AS lng,
    e.location_latitude,
    e.location_longitude,
    e.starts_at,
    e.ends_at,
    e.time_precision,
    e.time_precision = 'date_only'::text AS time_unknown,
    e.cost,
        CASE
            WHEN e.cost IS NULL THEN false
            ELSE lower(TRIM(BOTH FROM e.cost)) = ANY (ARRAY['free'::text, 'no cost'::text, '$0'::text, '0'::text, 'free admission'::text])
        END AS is_free,
    e.age_tags,
    e.age_min_months,
    e.age_max_months,
    e.age_band,
    e.is_outdoor,
    e.what_to_bring,
    e.registration_required,
    e.registration_url,
    e.source,
    e.source_id,
    e.source_url,
    e.added_by,
    e.content_status,
    e.geography_tier,
    e.experience_type,
    e.weather_fit,
    e.today_priority,
    e.discovery_priority,
    e.feed_score,
    e.classification_confidence,
    e.recurring_score,
    e.one_time_score,
    e.recurrence_pattern,
    e.verification_score,
    e.verification_tier,
    e.verification_reasons,
    e.content_verified_at,
    e.place_id,
    e.program_id,
    e.proposed_by_group,
    e.metro_area,
    e.status,
    e.last_verified_at,
        CASE
            WHEN e.last_verified_at >= (now() - '2 days'::interval) THEN 'verified_recently'::text
            WHEN e.last_verified_at >= (now() - '8 days'::interval) THEN 'confirmed_this_week'::text
            WHEN e.last_verified_at >= (now() - '21 days'::interval) OR e.program_id IS NOT NULL THEN 'likely_on'::text
            ELSE 'check_before_you_go'::text
        END AS currency_label,
    NOT (e.last_verified_at >= (now() - '21 days'::interval) OR e.program_id IS NOT NULL) AS needs_confirmation,
        CASE
            WHEN e.last_verified_at IS NULL THEN NULL::integer
            ELSE floor(EXTRACT(epoch FROM now() - e.last_verified_at) / 86400::numeric)::integer
        END AS last_verified_days
   FROM events e
     LEFT JOIN recurring_programs r ON r.id = e.program_id
     LEFT JOIN event_freshness_state fs ON fs.event_id = e.id
  WHERE e.status = 'published'::text AND e.is_kid_relevant AND e.content_status <> 'exclude'::text AND e.duplicate_of IS NULL AND e.duplicate_of_event_id IS NULL AND (NOT e.is_suppressed OR e.suppressed_reason IS NULL) AND ((e.verification_tier = ANY (ARRAY['trusted'::text, 'high'::text])) AND e.verification_score >= 80 OR e.proposed_by_group IS NOT NULL AND (EXISTS ( SELECT 1
           FROM group_members gm
          WHERE gm.group_id = e.proposed_by_group AND gm.user_id = auth.uid()))) AND (COALESCE(fs.freshness_state, ''::text) <> ALL (ARRAY['cancelled'::text, 'expired'::text, 'completed'::text])) AND fs.cancellation_detected_at IS NULL AND NOT (e.registration_required AND (e.last_verified_at IS NULL OR e.last_verified_at < (now() - '14 days'::interval))) AND (r.id IS NULL OR recurrence_occurrence_matches(e.starts_at, r.rrule));

create view public."feed_quality_audit" with (security_invoker=true) as
 SELECT count(*) FILTER (WHERE e.status = 'published'::text AND e.starts_at >= now()) AS upcoming_published,
    count(*) FILTER (WHERE e.status = 'published'::text AND e.starts_at >= now() AND NOT e.is_suppressed AND e.content_status = 'keep'::text) AS eligible_before_verification,
    count(*) FILTER (WHERE e.status = 'published'::text AND e.starts_at >= now() AND NOT e.is_suppressed AND e.content_status = 'keep'::text AND ((e.verification_tier <> ALL (ARRAY['trusted'::text, 'high'::text])) OR e.verification_score < 80 OR e.last_verified_at IS NULL OR e.last_verified_at < (now() - '7 days'::interval))) AS unsafe_records_blocked,
    count(*) FILTER (WHERE e.status = 'published'::text AND e.starts_at >= now() AND NOT e.is_suppressed AND e.program_id IS NOT NULL AND NOT recurrence_occurrence_matches(e.starts_at, r.rrule)) AS invalid_recurrence_blocked,
    count(*) FILTER (WHERE e.status = 'published'::text AND e.starts_at >= now() AND NOT e.is_suppressed AND (e.description ~* '<[^>]+>|&lt;|&gt;|\\\\1'::text OR e.address ~* '<[^>]+>|&lt;|&gt;|\\\\1'::text)) AS dirty_text_records
   FROM events e
     LEFT JOIN recurring_programs r ON r.id = e.program_id;

create view public."group_activity_feed" with (security_invoker=true) as
 SELECT id AS event_id,
    proposed_by_group AS group_id,
    added_by AS proposer_id,
    title,
    venue_name,
    starts_at,
    (( SELECT count(*) AS count
           FROM rsvps r
          WHERE r.event_id = e.id AND r.status = 'going'::text))::integer AS going_count,
    (EXISTS ( SELECT 1
           FROM rsvps r
          WHERE r.event_id = e.id AND r.status = 'going'::text AND r.user_id = auth.uid())) AS viewer_is_going
   FROM events e
  WHERE proposed_by_group IS NOT NULL AND status = 'published'::text AND COALESCE(is_suppressed, false) = false;

create view public."my_cancelled_upcoming" with (security_invoker=on) as
 SELECT e.id AS event_id,
    e.title,
    e.starts_at,
    e.venue_name,
    r.user_id
   FROM events e
     JOIN rsvps r ON r.event_id = e.id
  WHERE e.status = 'cancelled'::text AND e.starts_at >= now() AND r.user_id = auth.uid();

create view public."poppy_recommendation_candidates" as
 SELECT e.id,
    e.title,
    e.display_title,
    e.description,
    e.venue_name,
    e.venue_display,
    e.address,
    e.location_city,
    e.location_state,
    e.location_zip,
    e.lat,
    e.lng,
    e.location_latitude,
    e.location_longitude,
    e.starts_at,
    e.ends_at,
    e.age_min_months,
    e.age_max_months,
    e.age_band,
    e.age_tags,
    e.cost,
    e.source,
    e.source_url,
    e.registration_required,
    e.registration_url,
    e.is_outdoor,
    e.experience_type,
    e.weather_fit,
    e.is_kid_relevant,
    e.verification_tier,
    e.verification_score,
    e.content_review_status,
    e.last_verified_at,
    e.place_id,
    e.program_id,
    'event'::text AS kind,
    NULL::jsonb AS hours,
    NULL::date AS season_start,
    NULL::date AS season_end
   FROM events e
  WHERE e.starts_at > now() AND COALESCE(e.is_suppressed, false) = false AND e.status <> 'cancelled'::text AND COALESCE(e.content_review_status, ''::text) <> 'rejected'::text AND (e.verification_tier = ANY (ARRAY['trusted'::text, 'high'::text])) AND (e.geography_tier = ANY (ARRAY['pasco'::text, 'tampa'::text]))
UNION ALL
 SELECT p.id,
    p.name AS title,
    p.name AS display_title,
    COALESCE(p.toddler_notes, p.description) AS description,
    p.name AS venue_name,
    p.name AS venue_display,
    p.address,
    p.city AS location_city,
    p.state AS location_state,
    p.zip_code AS location_zip,
    COALESCE(p.lat, p.latitude) AS lat,
    COALESCE(p.lng, p.longitude) AS lng,
    COALESCE(p.lat, p.latitude) AS location_latitude,
    COALESCE(p.lng, p.longitude) AS location_longitude,
    NULL::timestamp with time zone AS starts_at,
    NULL::timestamp with time zone AS ends_at,
    p.age_min_months,
    p.age_max_months,
    NULL::text AS age_band,
    NULL::text[] AS age_tags,
    p.price_note AS cost,
    'place'::text AS source,
    COALESCE(p.source_url, p.website) AS source_url,
    NULL::boolean AS registration_required,
    NULL::text AS registration_url,
    p.is_outdoor,
    'evergreen_place'::text AS experience_type,
        CASE
            WHEN p.is_outdoor THEN 'outdoor'::text
            ELSE 'indoor'::text
        END AS weather_fit,
    true AS is_kid_relevant,
    p.llm_verification_status AS verification_tier,
    NULL::integer AS verification_score,
    NULL::text AS content_review_status,
    p.last_verified_at,
    p.id AS place_id,
    NULL::uuid AS program_id,
    'place'::text AS kind,
    p.hours,
    p.season_start,
    p.season_end
   FROM places p
  WHERE p.active = true AND p.llm_verification_status = 'verified'::text AND COALESCE(p.lat, p.latitude) IS NOT NULL AND COALESCE(p.lng, p.longitude) IS NOT NULL;

create view public."recommendation_candidate_learning" as
 SELECT candidate_id,
    count(*) AS feedback_count,
    count(*) FILTER (WHERE feedback = ANY (ARRAY['helpful'::text, 'saved'::text])) AS positive_count,
    count(*) FILTER (WHERE feedback = ANY (ARRAY['not_helpful'::text, 'dismissed'::text])) AS negative_count,
    count(*) FILTER (WHERE feedback = 'saved'::text) AS saved_count,
    count(*) FILTER (WHERE feedback = 'dismissed'::text) AS dismissed_count,
    round(100.0 * count(*) FILTER (WHERE feedback = ANY (ARRAY['helpful'::text, 'saved'::text]))::numeric / NULLIF(count(*), 0)::numeric, 1) AS positive_rate
   FROM recommendation_feedback
  GROUP BY candidate_id;

-- Triggers
CREATE TRIGGER crawler_source_admission BEFORE INSERT OR UPDATE OF source_url, active ON public.content_sources FOR EACH ROW EXECUTE FUNCTION enforce_crawler_source_admission();
CREATE TRIGGER trg_enforce_crawler_next_crawl BEFORE UPDATE ON public.content_sources FOR EACH ROW EXECUTE FUNCTION enforce_crawler_next_crawl();
CREATE TRIGGER trg_enforce_crawler_next_crawl_schedule BEFORE UPDATE ON public.content_sources FOR EACH ROW EXECUTE FUNCTION enforce_crawler_next_crawl_schedule();
CREATE TRIGGER trg_normalize_crawler_source_health BEFORE UPDATE ON public.content_sources FOR EACH ROW EXECUTE FUNCTION normalize_crawler_source_health();
CREATE TRIGGER trg_sync_run_source_health AFTER INSERT OR UPDATE OF status, discovered_count, created_count, updated_count, rejected_count, error_message ON public.content_sync_runs FOR EACH ROW EXECUTE FUNCTION update_source_health_from_sync_run();
CREATE TRIGGER normalize_discovery_run_status BEFORE UPDATE OF status ON public.discovery_runs FOR EACH ROW EXECUTE FUNCTION normalize_discovery_run_partial_status();
CREATE TRIGGER trg_normalize_discovery_run_status BEFORE INSERT OR UPDATE ON public.discovery_runs FOR EACH ROW EXECUTE FUNCTION normalize_discovery_run_status();
CREATE TRIGGER event_discovery_quality_rules BEFORE INSERT OR UPDATE ON public.event_discovery_candidates FOR EACH ROW EXECUTE FUNCTION apply_local_event_quality_rules();
CREATE TRIGGER trg_candidate_idempotency_key BEFORE INSERT OR UPDATE OF source_url, starts_at, title ON public.event_discovery_candidates FOR EACH ROW EXECUTE FUNCTION set_candidate_idempotency_key();
CREATE TRIGGER trg_classify_event_content_type BEFORE INSERT OR UPDATE OF title, description, reason ON public.event_discovery_candidates FOR EACH ROW EXECUTE FUNCTION classify_event_content_type();
CREATE TRIGGER trg_discovery_candidate_safety BEFORE INSERT OR UPDATE ON public.event_discovery_candidates FOR EACH ROW EXECUTE FUNCTION enforce_discovery_candidate_safety();
CREATE TRIGGER trg_discovery_promotion_readiness BEFORE INSERT OR UPDATE ON public.event_discovery_candidates FOR EACH ROW EXECUTE FUNCTION enforce_discovery_promotion_readiness();
CREATE TRIGGER trg_enforce_candidate_promotion_safety BEFORE INSERT OR UPDATE OF promotion_event_id, status, age_band ON public.event_discovery_candidates FOR EACH ROW EXECUTE FUNCTION enforce_candidate_promotion_safety();
CREATE TRIGGER trg_enforce_candidate_safety_filters BEFORE INSERT OR UPDATE ON public.event_discovery_candidates FOR EACH ROW EXECUTE FUNCTION enforce_candidate_safety_filters();
CREATE TRIGGER trg_normalize_family_candidate_quality BEFORE INSERT OR UPDATE OF title, venue_name, age_band, score, source_id ON public.event_discovery_candidates FOR EACH ROW EXECUTE FUNCTION normalize_family_candidate_quality();
CREATE TRIGGER trg_organizer_feedback AFTER UPDATE OF status ON public.event_discovery_candidates FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION apply_organizer_feedback();
CREATE TRIGGER trg_canonicalize_venue BEFORE INSERT OR UPDATE OF venue_name, title, organizer ON public.events FOR EACH ROW EXECUTE FUNCTION canonicalize_venue();
CREATE TRIGGER trg_enforce_event_publication_safety BEFORE INSERT OR UPDATE OF status, content_status, is_kid_relevant, is_suppressed, duplicate_of, verification_score, source_id, added_by ON public.events FOR EACH ROW EXECUTE FUNCTION enforce_event_publication_safety();
CREATE TRIGGER trg_event_freshness_publish_guard BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION enforce_event_freshness_publish_guard();
CREATE TRIGGER trg_events_setting_context BEFORE INSERT OR UPDATE OF place_id, title, description, venue_name, is_outdoor ON public.events FOR EACH ROW EXECUTE FUNCTION set_event_setting_from_context();
CREATE TRIGGER trg_guard_recurring_event_occurrence BEFORE INSERT OR UPDATE OF program_id, starts_at ON public.events FOR EACH ROW EXECUTE FUNCTION guard_recurring_event_occurrence();
CREATE TRIGGER trg_guard_source_verification BEFORE INSERT OR UPDATE OF source_id, title, description, starts_at, ends_at, venue_name, address ON public.events FOR EACH ROW EXECUTE FUNCTION guard_source_verification();
CREATE TRIGGER trg_normalize_event_text_fields BEFORE INSERT OR UPDATE OF title, description, venue_name, venue_display, organizer, room_name, address, cost, display_title ON public.events FOR EACH ROW EXECUTE FUNCTION normalize_event_text_fields();
CREATE TRIGGER trg_normalize_verified_event_source BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION normalize_verified_event_source();
CREATE TRIGGER trg_verified_feed_gate BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION enforce_verified_feed_gate();
CREATE TRIGGER groups_add_creator_member AFTER INSERT ON public.groups FOR EACH ROW EXECUTE FUNCTION add_creator_as_member();

-- Row level security
alter table public."activity_source_records" enable row level security;
alter table public."activity_sources" enable row level security;
alter table public."availability" enable row level security;
alter table public."community_event_signals" enable row level security;
alter table public."community_signal_run_audit" enable row level security;
alter table public."content_sources" enable row level security;
alter table public."content_sync_runs" enable row level security;
alter table public."discovery_queries" enable row level security;
alter table public."discovery_runs" enable row level security;
alter table public."event_candidate_quality" enable row level security;
alter table public."event_comments" enable row level security;
alter table public."event_discovery_candidates" enable row level security;
alter table public."event_duplicate_clusters" enable row level security;
alter table public."event_freshness_checks" enable row level security;
alter table public."event_freshness_state" enable row level security;
alter table public."event_pipeline_alerts" enable row level security;
alter table public."event_pipeline_health_audit_log" enable row level security;
alter table public."event_pipeline_source_health" enable row level security;
alter table public."event_source_trust" enable row level security;
alter table public."events" enable row level security;
alter table public."group_event_plans" enable row level security;
alter table public."group_members" enable row level security;
alter table public."group_proposal_notifications" enable row level security;
alter table public."groups" enable row level security;
alter table public."known_organizers" enable row level security;
alter table public."market_coverage_slo" enable row level security;
alter table public."markets" enable row level security;
alter table public."organizer_candidates" enable row level security;
alter table public."organizer_source_links" enable row level security;
alter table public."outing_feedback" enable row level security;
alter table public."place_exposure" enable row level security;
alter table public."place_geocode_backfill" enable row level security;
alter table public."place_revalidation_runs" enable row level security;
alter table public."place_tips" enable row level security;
alter table public."places" enable row level security;
alter table public."profiles" enable row level security;
alter table public."recommendation_audit" enable row level security;
alter table public."recommendation_feedback" enable row level security;
alter table public."recommendation_requests" enable row level security;
alter table public."recommendation_response_cache" enable row level security;
alter table public."recurring_programs" enable row level security;
alter table public."rsvps" enable row level security;
alter table public."venue_aliases" enable row level security;

-- RLS policies
create policy "delete own availability" on public."availability" for DELETE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read group availability" on public."availability" for SELECT to public
  using (is_member(group_id));
create policy "update own availability" on public."availability" for UPDATE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "write own availability" on public."availability" for INSERT to public
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND is_member(group_id)));
create policy "delete own comments" on public."event_comments" for DELETE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "edit own comments" on public."event_comments" for UPDATE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read comments in my groups" on public."event_comments" for SELECT to public
  using (is_member(group_id));
create policy "write own comments" on public."event_comments" for INSERT to public
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND is_member(group_id)));
create policy "add events" on public."events" for INSERT to authenticated
  with check (((added_by = ( SELECT auth.uid() AS uid)) AND (proposed_by_group IS NOT NULL) AND (is_member(proposed_by_group) OR (EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.id = events.proposed_by_group) AND (g.created_by = ( SELECT auth.uid() AS uid))))))));
create policy "delete own proposed events" on public."events" for DELETE to public
  using (((added_by = ( SELECT auth.uid() AS uid)) AND (proposed_by_group IS NOT NULL)));
create policy "edit own events" on public."events" for UPDATE to public
  using (((added_by = ( SELECT auth.uid() AS uid)) AND (proposed_by_group IS NOT NULL)))
  with check (((added_by = ( SELECT auth.uid() AS uid)) AND (proposed_by_group IS NOT NULL) AND is_member(proposed_by_group)));
create policy "read events" on public."events" for SELECT to authenticated
  using (((content_status = 'keep'::text) AND ((proposed_by_group IS NULL) OR is_member(proposed_by_group) OR (EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.id = events.proposed_by_group) AND (g.created_by = ( SELECT auth.uid() AS uid))))))));
create policy "group_event_plans_insert_members" on public."group_event_plans" for INSERT to authenticated
  with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = group_event_plans.group_id) AND (gm.user_id = ( SELECT auth.uid() AS uid)))))));
create policy "group_event_plans_select_members" on public."group_event_plans" for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM group_members gm
  WHERE ((gm.group_id = group_event_plans.group_id) AND (gm.user_id = ( SELECT auth.uid() AS uid))))));
create policy "group_event_plans_update_creator" on public."group_event_plans" for UPDATE to authenticated
  using ((created_by = ( SELECT auth.uid() AS uid)))
  with check ((created_by = ( SELECT auth.uid() AS uid)));
create policy "join only through trusted function" on public."group_members" for INSERT to authenticated
  with check (false);
create policy "leave group" on public."group_members" for DELETE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read rosters of my groups" on public."group_members" for SELECT to public
  using (is_member(group_id));
create policy "update own membership" on public."group_members" for UPDATE to public
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "members can mark their proposal notifications read" on public."group_proposal_notifications" for UPDATE to authenticated
  using ((recipient_id = ( SELECT auth.uid() AS uid)))
  with check ((recipient_id = ( SELECT auth.uid() AS uid)));
create policy "members can read their proposal notifications" on public."group_proposal_notifications" for SELECT to authenticated
  using ((recipient_id = ( SELECT auth.uid() AS uid)));
create policy "create group" on public."groups" for INSERT to public
  with check ((created_by = ( SELECT auth.uid() AS uid)));
create policy "read my groups" on public."groups" for SELECT to public
  using ((is_member(id) OR (created_by = ( SELECT auth.uid() AS uid))));
create policy "read markets" on public."markets" for SELECT to public
  using ((( SELECT auth.role() AS role) = 'authenticated'::text));
create policy "read shared feedback" on public."outing_feedback" for SELECT to public
  using (((user_id = ( SELECT auth.uid() AS uid)) OR shares_group_with(user_id)));
create policy "update own feedback" on public."outing_feedback" for UPDATE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "write own feedback" on public."outing_feedback" for INSERT to public
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read own place exposure" on public."place_exposure" for SELECT to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "update own place exposure" on public."place_exposure" for UPDATE to public
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "write own place exposure" on public."place_exposure" for INSERT to public
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "delete own tips" on public."place_tips" for DELETE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "edit own tips" on public."place_tips" for UPDATE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read group tips" on public."place_tips" for SELECT to public
  using (is_member(group_id));
create policy "write own tips" on public."place_tips" for INSERT to public
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND is_member(group_id)));
create policy "read places" on public."places" for SELECT to authenticated
  using (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (llm_verification_status = 'verified'::text) AND (lat IS NOT NULL) AND (lng IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM markets m
  WHERE ((m.id = places.metro_area) AND m.active)))));
create policy "insert own profile" on public."profiles" for INSERT to public
  with check ((id = ( SELECT auth.uid() AS uid)));
create policy "read self or shared" on public."profiles" for SELECT to public
  using (((id = ( SELECT auth.uid() AS uid)) OR shares_group_with(id)));
create policy "update own profile" on public."profiles" for UPDATE to public
  using ((id = ( SELECT auth.uid() AS uid)));
create policy "recommendation_audit_insert_own" on public."recommendation_audit" for INSERT to authenticated
  with check ((EXISTS ( SELECT 1
   FROM recommendation_requests r
  WHERE ((r.id = recommendation_audit.request_id) AND (r.user_id = ( SELECT auth.uid() AS uid))))));
create policy "recommendation_feedback_insert_own" on public."recommendation_feedback" for INSERT to authenticated
  with check ((EXISTS ( SELECT 1
   FROM recommendation_requests r
  WHERE ((r.id = recommendation_feedback.request_id) AND (r.user_id = ( SELECT auth.uid() AS uid))))));
create policy "recommendation_feedback_select_own" on public."recommendation_feedback" for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM recommendation_requests r
  WHERE ((r.id = recommendation_feedback.request_id) AND (r.user_id = ( SELECT auth.uid() AS uid))))));
create policy "recommendation_requests_insert_own" on public."recommendation_requests" for INSERT to authenticated
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "recommendation_requests_select_own" on public."recommendation_requests" for SELECT to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "recommendation_response_cache_insert_own" on public."recommendation_response_cache" for INSERT to authenticated
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "recommendation_response_cache_select_own" on public."recommendation_response_cache" for SELECT to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "recommendation_response_cache_update_own" on public."recommendation_response_cache" for UPDATE to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read programs" on public."recurring_programs" for SELECT to public
  using (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM markets m
  WHERE ((m.id = recurring_programs.metro_area) AND m.active)))));
create policy "delete own rsvp" on public."rsvps" for DELETE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "insert own rsvp" on public."rsvps" for INSERT to public
  with check ((user_id = ( SELECT auth.uid() AS uid)));
create policy "read own or shared rsvps" on public."rsvps" for SELECT to public
  using (((user_id = ( SELECT auth.uid() AS uid)) OR shares_group_with(user_id)));
create policy "update own rsvp" on public."rsvps" for UPDATE to public
  using ((user_id = ( SELECT auth.uid() AS uid)));
create policy "public can read venue aliases" on public."venue_aliases" for SELECT to public
  using (true);
