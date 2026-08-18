-- ============================================================
-- Activity/Source Foundation (v6)
--
-- Foundation for external activity aggregation, scoped to Momma's Meetup's
-- initial market (Wesley Chapel + ~45min). Does NOT add scrapers or
-- external integrations — this is schema only.
--
-- Deliberately does not touch events/places/recurring_programs. Those
-- tables' existing source-tracking (events.source/external_id/
-- uniq_events_source_external, used by materialize_programs()) is left
-- completely alone. The gap this fills is different: no existing table
-- can represent "the same real-world activity, listed on N different
-- external sources" — a many-to-one relationship, which needs its own
-- table rather than another column on any single entity table.
-- ============================================================

-- One row per external feed/origin (a specific library system's Communico
-- calendar, a specific venue's RSS feed, etc.) — not per listing.
create table activity_sources (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  source_type              text not null check (source_type in ('communico', 'libcal', 'rss', 'ical', 'manual', 'other')),
  base_url                 text,
  metro_area               text not null references markets(id),
  active                   boolean not null default true,
  fetch_frequency_minutes  int,
  last_fetch_at            timestamptz,
  last_fetch_status        text check (last_fetch_status in ('success', 'partial', 'error')),
  last_fetch_error         text,
  last_success_at          timestamptz,
  created_at               timestamptz not null default now()
);

create index idx_activity_sources_market on activity_sources (metro_area) where active;

-- One row per (source, external listing) as ingested — the traceability,
-- dedup, and raw-debug layer. Resolves onto at most one of
-- events/places/recurring_programs; multiple source_records resolving to
-- the SAME entity is the expected shape for a listing seen on several
-- sources.
create table activity_source_records (
  id                    uuid primary key default gen_random_uuid(),
  source_id             uuid not null references activity_sources(id) on delete cascade,
  external_id           text not null,
  external_url          text,
  -- Raw fetched payload, kept only for debugging bad imports. Never
  -- exposed to normal users — see RLS below (no select policy exists).
  raw_payload           jsonb,
  -- Deterministic cross-source dedup key (see normalize_dedup_key below).
  -- Deliberately NOT unique: multiple sources describing the same
  -- real-world activity are expected to share one dedup_key.
  dedup_key             text not null,
  resolved_event_id     uuid references events(id) on delete set null,
  resolved_place_id     uuid references places(id) on delete set null,
  resolved_program_id   uuid references recurring_programs(id) on delete set null,
  first_seen_at         timestamptz not null default now(),
  -- Bumped by the (future) ingestion pipeline every time this external_id
  -- is re-encountered in a fetch. A record that goes stale relative to its
  -- source's fetch cadence is the cancellation/staleness signal — the
  -- pipeline then updates the EXISTING events.status / places.active /
  -- recurring_programs.active field, not a new field here.
  last_seen_at          timestamptz not null default now(),
  verification_status   text not null default 'needs_review'
                           check (verification_status in ('needs_review', 'verified', 'stale', 'cancelled')),
  created_at            timestamptz not null default now(),
  check (num_nonnulls(resolved_event_id, resolved_place_id, resolved_program_id) <= 1)
);

create unique index uniq_source_records_source_external on activity_source_records (source_id, external_id);
create index idx_source_records_dedup_key on activity_source_records (dedup_key);
create index idx_source_records_resolved_event on activity_source_records (resolved_event_id) where resolved_event_id is not null;
create index idx_source_records_resolved_place on activity_source_records (resolved_place_id) where resolved_place_id is not null;
create index idx_source_records_resolved_program on activity_source_records (resolved_program_id) where resolved_program_id is not null;

-- Deterministic, explainable cross-source dedup key: normalized title +
-- normalized venue + calendar date. Exact-match only, no fuzzy matching —
-- two source_records sharing a key are treated as the same real-world
-- activity. Computing this is the (future) ingestion pipeline's job; this
-- function just gives it one canonical, testable implementation to call.
create or replace function normalize_dedup_key(title text, venue text, event_date date)
returns text language sql immutable as $$
  select lower(trim(regexp_replace(coalesce(title, ''), '\s+', ' ', 'g')))
    || '|' || lower(trim(regexp_replace(coalesce(venue, ''), '\s+', ' ', 'g')))
    || '|' || coalesce(event_date::text, '');
$$;

alter table activity_sources        enable row level security;
alter table activity_source_records enable row level security;

-- Deliberately no policies on either table: not readable or writable by
-- the anon/authenticated role under any circumstance. This is operational/
-- debug data (raw_payload, fetch errors), never meant for normal users.
-- The future ingestion pipeline will need SUPABASE_SERVICE_ROLE_KEY
-- (already a documented-but-unused placeholder in .env.example) to write
-- here, since RLS blocks the anon key entirely by design.
