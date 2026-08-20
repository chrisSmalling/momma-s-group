-- v10: add events.added_by to the public.feed_events view.
--
-- IMPORTANT CONTEXT: public.feed_events itself, along with several
-- columns it depends on (is_suppressed, duplicate_of, display_title,
-- venue_display, room_name, organizer, time_precision), the
-- canonicalize_venue() trigger that populates the display columns, and a
-- venue_aliases table it consults, were all added directly to the live
-- database out-of-band -- not through a migration file in this repo, and
-- not authored by the ingestion work in supabase/migrations/2026081*.
-- A "db/schema-snapshot.sql" was referenced as the ground-truth source
-- for that restructure but does not exist anywhere in this repository as
-- of this migration; db/schema.sql's `events` table definition does NOT
-- yet reflect those columns. This migration captures only the one change
-- made on top of that restructure (adding added_by to the view, verified
-- directly against the live view definition via pg_get_viewdef) -- it
-- does NOT recreate the columns/trigger/table above, and will fail if
-- run against a database that doesn't already have them. Reconciling
-- db/schema.sql with the real live schema needs that snapshot file (or
-- an equivalent full pg_dump) committed to this repo.
--
-- The actual change: /today and /calendar need to show "Proposed by
-- {name}" for user-proposed meetups, which requires events.added_by --
-- the view didn't expose it. Added at the end of the column list
-- (required for CREATE OR REPLACE VIEW to avoid renumbering existing
-- columns); no other column changed.
create or replace view public.feed_events
with (security_invoker = on)
as
 select id,
    coalesce(display_title, title) as title,
    description,
    coalesce(venue_display, organizer, venue_name) as venue,
    room_name,
    organizer,
    address,
    lat,
    lng,
    starts_at,
    ends_at,
    time_precision,
    time_precision = 'date_only'::text as time_unknown,
    cost,
    cost is null as is_free,
    age_tags,
    age_min_months,
    age_max_months,
    is_outdoor,
    what_to_bring,
    registration_required,
    registration_url,
    source,
    source_url,
    place_id,
    program_id,
    proposed_by_group,
    metro_area,
    status,
    last_verified_at,
    added_by
   from events e
  where status = 'published'::text and is_kid_relevant and not is_suppressed and duplicate_of is null;
