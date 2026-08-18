-- ============================================================
-- Momma's Meetup — Postgres schema for Supabase (v6)
-- Run this in the Supabase SQL Editor.
-- Auth users are managed by Supabase in auth.users; we reference them.
--
-- v2 added `places` (curated venues with open hours — nothing to RSVP to
-- directly) and `recurring_programs` (a recurring class/open-play slot at a
-- place, expanded into real `events` rows by materialize_programs()), plus
-- new columns on `events` for that: place_id, program_id, status,
-- registration_required/url, age_min/max_months, and proposed_by_group for
-- user-proposed meetups.
--
-- v3 adds: venue-practicalities columns on `places` (is_enclosed,
-- has_changing_table, nursing_friendly, stroller_accessible, food_onsite,
-- quiet_or_sensory_friendly, parking_notes, best_time_note,
-- typical_crowd_note, what_to_bring) plus is_outdoor/what_to_bring on
-- `events`; `event_comments` (a flat, group-scoped comment thread per
-- event, realtime-enabled); `place_tips` (durable group tips, either
-- place-scoped or event-scoped, promoted from a comment via
-- promote_comment_to_tip()); `outing_feedback` (post-outing "would
-- repeat" + note, one row per person per event); nap_start/nap_end/
-- child_age_months/home_lat/home_lng on `profiles`; the my_cancelled_upcoming
-- view; and cancel_event(). rsvps and event_comments are added to the
-- supabase_realtime publication.
--
-- v4 adds: a 4th/5th rsvps.status value pair (not_going, out_sick) plus an
-- optional rsvps.note; group_members.things_to_know (allergies/medical
-- notes, member-editable, group-visible); and `availability` (a user's free
-- windows, scoped to a group, realtime-enabled) paired with who_is_free(),
-- which computes the caller's own windows, overlapping groupmates, and
-- events that fit.
--
-- v5 adds: `markets` (curated geographic markets — initially just
-- 'tampa_bay' / "Wesley Chapel + 45 min"), with events/places/
-- recurring_programs.metro_area now FK'd to it; distance_km(), a plain
-- Haversine great-circle-distance helper (NOT a real drive time — no
-- routing/traffic data is available to a SQL function; the app must compute
-- this per-viewer from profiles.home_lat/home_lng and label it as an
-- approximate distance); places/recurring_programs RLS now also requires
-- the row's market to be active (events' RLS does not — confirmed
-- asymmetry, not changed here); and rsvps.updated_at (present live, but no
-- trigger keeps it current — defaults on insert only). Everything in this
-- v5 section was read directly from the live database via the Supabase MCP
-- connection, not guessed.
--
-- v6 adds: the activity/source foundation for external activity
-- aggregation (`activity_sources`, `activity_source_records`,
-- normalize_dedup_key()) — infrastructure only, no scrapers or external
-- integrations. Deliberately does not modify events/places/
-- recurring_programs; see the tables' own comments for why. Both new
-- tables have RLS enabled with no policies at all (not readable/writable
-- by anon/authenticated by design). This section was NOT applied to the
-- live database this session (Supabase MCP was disconnected) — it's a
-- ready-to-apply migration (supabase/migrations/) rather than a mirror of
-- confirmed live state, unlike v1-v5 above. Confirm before treating v6 as
-- live fact.
--
-- This file mirrors the live schema; it is not re-run against the existing
-- project.
-- ============================================================

-- ---------- Tables ------------------------------------------

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text not null,
  avatar_color      text not null default '#C0356E',
  created_at        timestamptz not null default now(),
  nap_start         time,
  nap_end           time,
  child_age_months  int,
  home_lat          double precision,
  home_lng          double precision
);

create table groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text not null unique default encode(gen_random_bytes(5), 'hex'),
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

create table group_members (
  group_id        uuid not null references groups(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  joined_at       timestamptz not null default now(),
  -- Allergies/medical notes, e.g. "peanut allergy, we bring our own
  -- snacks". Optional, editable by the member, visible to their group.
  things_to_know  text check (things_to_know is null or length(things_to_know) <= 300),
  primary key (group_id, user_id)
);

-- A geographic market — initially just Wesley Chapel + a 45-minute drive
-- radius. events/places/recurring_programs.metro_area FK to this. Curated,
-- no app-side writes (same shape as places/recurring_programs: read-only
-- reference data, admin-managed).
create table markets (
  id              text primary key,
  name            text not null,
  center_lat      double precision not null,
  center_lng      double precision not null,
  radius_minutes  int not null default 45,
  timezone        text not null default 'America/New_York',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- A venue with open hours — nothing scheduled, nothing to RSVP to. Curated
-- (fed in by hand or a scraper), not user-generated.
create table places (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  address                     text,
  lat                         double precision,
  lng                         double precision,
  metro_area                  text not null default 'tampa_bay' references markets(id),
  hours                       jsonb,                     -- e.g. {"mon": "10:00-21:00", ...}
  description                 text,
  toddler_notes               text,
  price_note                  text,
  age_min_months              int,
  age_max_months              int,
  website                     text,
  booking_url                 text,
  phone                       text,
  source_url                  text,
  last_verified_at            timestamptz,
  active                      boolean not null default true,
  created_at                  timestamptz not null default now(),
  is_enclosed                 boolean,
  is_outdoor                  boolean not null default false,
  has_changing_table          boolean,
  nursing_friendly            boolean,
  stroller_accessible         boolean,
  food_allowed                boolean,
  food_onsite                 boolean,
  restrooms                   boolean,
  parking_notes               text,
  what_to_bring                text[] not null default '{}',
  quiet_or_sensory_friendly   boolean,
  typical_crowd_note          text,
  best_time_note              text
);

create index idx_places_metro on places (metro_area) where active;

-- A recurring class/open-play slot at a place (e.g. "Toddler Time every
-- Tue/Thu at 10am"). Not shown directly — materialize_programs() expands
-- each active program into real `events` rows a rolling window ahead.
create table recurring_programs (
  id                    uuid primary key default gen_random_uuid(),
  place_id              uuid references places(id) on delete cascade,
  venue_name            text,
  address               text,
  metro_area            text not null default 'tampa_bay' references markets(id),
  title                 text not null,
  description           text,
  rrule                 text not null,        -- e.g. 'FREQ=WEEKLY;BYDAY=TU,TH'
  start_time            time not null,
  duration_minutes      int not null default 30,
  age_min_months        int,
  age_max_months        int,
  age_label             text,
  cost                  text,
  registration_required boolean not null default false,
  registration_url      text,
  season_start          date,
  season_end            date,
  source                text not null default 'manual',
  source_url            text,
  last_verified_at      timestamptz,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

create index idx_programs_active on recurring_programs (active, metro_area);

create table events (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  description            text,
  venue_name             text,
  address                text,
  lat                    double precision,
  lng                    double precision,
  starts_at              timestamptz not null,
  ends_at                timestamptz,
  age_tags               text[] not null default '{}',
  cost                   text,                              -- null = free, else e.g. '$15'
  source                 text not null default 'manual',    -- manual | communico | libcal | rss
  source_url             text,
  added_by               uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  place_id               uuid references places(id) on delete set null,
  program_id             uuid references recurring_programs(id) on delete set null,
  metro_area             text not null default 'tampa_bay' references markets(id),
  external_id            text,                              -- feed-source id, for upsert on re-ingest
  status                 text not null default 'published' check (status in ('published', 'cancelled')),
  registration_required  boolean not null default false,
  registration_url       text,
  age_min_months         int,
  age_max_months         int,
  -- Set only on user-proposed meetups (see "add events" policy below); null
  -- for curated/materialized events, which is what makes them visible to
  -- everyone rather than just one group.
  proposed_by_group      uuid references groups(id) on delete cascade,
  last_verified_at       timestamptz,
  is_outdoor             boolean not null default false,
  what_to_bring          text[] not null default '{}'
);

create index idx_events_starts_at on events (starts_at);
create index idx_events_metro_starts on events (metro_area, starts_at);
create index idx_events_place on events (place_id);
create index idx_events_proposed_group on events (proposed_by_group);

-- Lets a re-ingest of the same feed source update rather than duplicate a row.
create unique index uniq_events_source_external on events (source, external_id)
  where external_id is not null;

-- One row per person per event. This is the whole trick: an RSVP belongs to a
-- PERSON, not a group, so every group that person is in can see it.
create table rsvps (
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null check (status in ('going', 'maybe', 'not_going', 'out_sick')),
  -- Optional short note, e.g. "running 10 min late" or "bringing a friend".
  note        text check (note is null or length(note) <= 200),
  created_at  timestamptz not null default now(),
  -- Defaults on insert only — there's no trigger keeping this current on
  -- update, so it reflects insert time unless a future write sets it
  -- explicitly. Not used by the app today.
  updated_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index idx_rsvps_user on rsvps (user_id);
create index idx_group_members_user on group_members (user_id);

-- A durable tip, scoped to a group, attached to either a place or a specific
-- event (never both — see promote_comment_to_tip()).
create table place_tips (
  id             uuid primary key default gen_random_uuid(),
  place_id       uuid references places(id) on delete cascade,
  event_id       uuid references events(id) on delete cascade,
  group_id       uuid not null references groups(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  body           text not null check (length(trim(body)) > 0 and length(body) <= 500),
  category       text not null default 'general'
                   check (category in ('general', 'parking', 'timing', 'facilities', 'cost', 'accessibility')),
  helpful_count  int not null default 0,
  created_at     timestamptz not null default now()
);

create index idx_place_tips_place on place_tips (place_id);
create index idx_place_tips_event on place_tips (event_id);
create index idx_place_tips_group on place_tips (group_id);

-- A flat, group-scoped comment thread on an event. Any group a commenter
-- picks (not necessarily tied to the event's own proposed_by_group) — the
-- app scopes reads/writes to whichever group is "active" in the UI.
create table event_comments (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events(id) on delete cascade,
  group_id         uuid not null references groups(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  body             text not null check (length(trim(body)) > 0 and length(body) <= 1000),
  -- Set by promote_comment_to_tip() when a group member turns this comment
  -- into a durable place_tips row.
  promoted_tip_id  uuid references place_tips(id),
  edited_at        timestamptz,
  created_at       timestamptz not null default now()
);

create index idx_event_comments_event on event_comments (event_id, created_at);

-- A window of time a user has marked free, scoped to a group.
create table availability (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  group_id    uuid not null references groups(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  note        text check (note is null or length(note) <= 200),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index idx_availability_group on availability (group_id, starts_at);

-- Post-outing "would you do this again" — one row per person per event.
create table outing_feedback (
  event_id     uuid not null references events(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  would_repeat boolean not null,
  note         text check (note is null or length(note) <= 300),
  created_at   timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Activity/source foundation (v6) — external activity aggregation, scoped
-- to Momma's Meetup's initial market. Deliberately does not touch events/
-- places/recurring_programs: events.source/external_id/
-- uniq_events_source_external (used by materialize_programs()) is left
-- completely alone. The gap this fills is different — no existing table
-- can represent "the same real-world activity, listed on N different
-- external sources," a many-to-one relationship that needs its own table.

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

-- ---------- Views --------------------------------------------

-- NOTE: this view is a plain (non security_invoker) view owned by the
-- `postgres` role, which bypasses RLS on `events`/`rsvps` when the view is
-- queried — verified empirically: it returns EVERY user's cancelled RSVPs,
-- not just the caller's own, regardless of group membership. The app must
-- always add an explicit `.eq('user_id', <current user>)` filter when
-- querying this view; do not rely on it being self-scoping.
create view my_cancelled_upcoming as
select e.id as event_id, e.title, e.starts_at, e.venue_name, r.user_id
from events e
join rsvps r on r.event_id = e.id
where e.status = 'cancelled' and e.starts_at >= now();

-- ---------- Helper functions --------------------------------

-- Deterministic, explainable cross-source dedup key for
-- activity_source_records: normalized title + normalized venue + calendar
-- date. Exact-match only, no fuzzy matching — two source_records sharing a
-- key are treated as the same real-world activity. Computing this is the
-- (future) ingestion pipeline's job; this function just gives it one
-- canonical, testable implementation to call.
create or replace function normalize_dedup_key(title text, venue text, event_date date)
returns text language sql immutable as $$
  select lower(trim(regexp_replace(coalesce(title, ''), '\s+', ' ', 'g')))
    || '|' || lower(trim(regexp_replace(coalesce(venue, ''), '\s+', ' ', 'g')))
    || '|' || coalesce(event_date::text, '');
$$;

-- True if the current user shares at least one group with `target`.
create or replace function shares_group_with(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from group_members me
    join group_members them on me.group_id = them.group_id
    where me.user_id = auth.uid()
      and them.user_id = target
  );
$$;

-- True if the current user is a member of group `g`.
create or replace function is_member(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members where group_id = g and user_id = auth.uid()
  );
$$;

-- Join a group by its invite code (lets account B join account A's group
-- without being able to browse all groups).
create or replace function join_group_by_code(code text)
returns uuid language plpgsql security definer set search_path = public as $$
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
$$;

-- Expands every active recurring_program into concrete `events` rows for the
-- next `days_ahead` days (default 60), matching rrule's BYDAY tokens against
-- each candidate date and respecting season_start/season_end. Re-running is
-- safe: re-materialized occurrences upsert via uniq_events_source_external
-- on (source, external_id). Intended to run on a schedule (cron/edge
-- function), not from the app.
create or replace function materialize_programs(days_ahead integer default 60)
returns integer language plpgsql security definer set search_path = public as $$
declare
  p            record;
  d            date;
  dow_token    text;
  made         int := 0;
  local_start  timestamptz;
begin
  for p in select * from public.recurring_programs where active loop
    d := current_date;
    while d <= current_date + days_ahead loop
      dow_token := case extract(dow from d)
        when 0 then 'SU' when 1 then 'MO' when 2 then 'TU' when 3 then 'WE'
        when 4 then 'TH' when 5 then 'FR' else 'SA' end;

      if p.rrule like '%' || dow_token || '%'
         and (p.season_start is null or d >= p.season_start)
         and (p.season_end   is null or d <= p.season_end) then

        -- construct in the venue's local timezone so DST is handled by Postgres
        local_start := (d::text || ' ' || p.start_time::text)::timestamp
                         at time zone 'America/New_York';

        insert into public.events (
          title, description, venue_name, address, starts_at, ends_at,
          age_tags, age_min_months, age_max_months, cost,
          source, source_url, external_id, program_id,
          registration_required, registration_url, metro_area, last_verified_at
        ) values (
          p.title, p.description, p.venue_name, p.address,
          local_start, local_start + (p.duration_minutes || ' minutes')::interval,
          case when p.age_label is null then '{}'::text[] else array[p.age_label] end,
          p.age_min_months, p.age_max_months, p.cost,
          p.source, p.source_url,
          'prog:' || p.id::text || ':' || d::text,
          p.id, p.registration_required, p.registration_url,
          p.metro_area, p.last_verified_at
        )
        on conflict (source, external_id) where external_id is not null
        do update set
          title = excluded.title,
          description = excluded.description,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          cost = excluded.cost,
          last_verified_at = excluded.last_verified_at;

        made := made + 1;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return made;
end;
$$;

-- Marks an event cancelled (appending `reason` to its description) and
-- returns everyone who'd RSVP'd, for notification purposes. Not exposed in
-- the app UI — a curator/admin tool.
create or replace function cancel_event(target_event uuid, reason text default null)
returns table(user_id uuid, display_name text, event_title text, starts_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  update public.events
     set status = 'cancelled',
         description = case
           when reason is null then description
           else coalesce(description,'') || E'\n\nCANCELLED: ' || reason
         end
   where id = target_event;

  return query
    select r.user_id, p.display_name, e.title, e.starts_at
    from public.rsvps r
    join public.events e on e.id = r.event_id
    left join public.profiles p on p.id = r.user_id
    where r.event_id = target_event;
end;
$$;

-- Returns the caller's own upcoming free windows in `target_group` over the
-- next `days_ahead` days, one row per window, each paired with which other
-- group members' windows overlap it (display names) and which upcoming
-- published events fall inside it. Byte-for-byte from the live database.
create or replace function who_is_free(target_group uuid, days_ahead integer default 14)
returns table(
  window_start    timestamptz,
  window_end      timestamptz,
  also_free       text[],
  matching_events jsonb
) language sql stable security definer set search_path = 'public' as $$
  with mine as (
    select a.id, a.starts_at, a.ends_at
    from public.availability a
    where a.user_id = auth.uid()
      and a.group_id = target_group
      and a.ends_at >= now()
      and a.starts_at <= now() + (days_ahead || ' days')::interval
  )
  select
    m.starts_at,
    m.ends_at,
    coalesce((
      select array_agg(distinct p.display_name)
      from public.availability o
      join public.profiles p on p.id = o.user_id
      where o.group_id = target_group
        and o.user_id <> auth.uid()
        and o.starts_at < m.ends_at
        and o.ends_at   > m.starts_at
    ), '{}'::text[]),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'title', e.title,
               'starts_at', e.starts_at, 'venue', e.venue_name, 'cost', e.cost)
               order by e.starts_at)
      from public.events e
      where e.status = 'published'
        and e.starts_at >= m.starts_at
        and e.starts_at <  m.ends_at
        and (e.proposed_by_group is null or e.proposed_by_group = target_group)
    ), '[]'::jsonb)
  from mine m
  order by m.starts_at;
$$;

-- Great-circle (Haversine) distance in km between two lat/lng points. This
-- is straight-line "as the crow flies" distance, NOT a real drive time —
-- there's no routing/traffic data available to a plain SQL function. The
-- app must compute this per-viewer from profiles.home_lat/home_lng (never
-- store it on the event) and label it as an approximate distance, not a
-- drive-time estimate, unless a real routing API is wired in separately.
create or replace function distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Turns a comment into a durable place_tips row: place-scoped if the
-- comment's event has a place_id, otherwise event-scoped. Callable by any
-- member of the comment's group (not just the comment's author) — that's
-- the point of "promote to tip" being a shared, group-level curation action.
create or replace function promote_comment_to_tip(comment_id uuid, tip_category text default 'general')
returns uuid language plpgsql security definer set search_path = public as $$
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
$$;

-- ---------- Row-Level Security ------------------------------

alter table profiles           enable row level security;
alter table groups             enable row level security;
alter table group_members      enable row level security;
alter table markets            enable row level security;
alter table places             enable row level security;
alter table recurring_programs enable row level security;
alter table events             enable row level security;
alter table rsvps              enable row level security;
alter table event_comments     enable row level security;
alter table place_tips         enable row level security;
alter table outing_feedback    enable row level security;
alter table availability       enable row level security;
alter table activity_sources        enable row level security;
alter table activity_source_records enable row level security;

-- activity_sources / activity_source_records: deliberately NO policies on
-- either table — not readable or writable by anon/authenticated under any
-- circumstance. This is operational/debug data (raw_payload, fetch
-- errors), never meant for normal users. The ingestion pipeline will need
-- SUPABASE_SERVICE_ROLE_KEY (already a documented-but-unused placeholder
-- in .env.example) to write here, since RLS blocks the anon key entirely
-- by design.

-- profiles: see your own, and anyone you share a group with (to render names/avatars)
create policy "read self or shared" on profiles for select
  using (id = auth.uid() or shares_group_with(id));
create policy "insert own profile" on profiles for insert with check (id = auth.uid());
create policy "update own profile" on profiles for update using (id = auth.uid());

-- groups: readable by members (or the creator). Joining by code goes through the function above.
create policy "read my groups" on groups for select
  using (is_member(id) or created_by = auth.uid());
create policy "create group" on groups for insert with check (created_by = auth.uid());

-- group_members: see the roster of groups you belong to; add yourself
create policy "read rosters of my groups" on group_members for select
  using (is_member(group_id));
create policy "add self to group" on group_members for insert with check (user_id = auth.uid());
create policy "leave group" on group_members for delete using (user_id = auth.uid());

-- markets: curated read-only reference data, no user writes.
create policy "read markets" on markets for select using (auth.role() = 'authenticated');

-- places, recurring_programs: curated read-only reference data, no user
-- writes. Also gated on the row's market being active — a place/program in
-- a deactivated market stops being readable.
create policy "read places" on places for select
  using (
    auth.role() = 'authenticated'
    and exists (select 1 from markets m where m.id = places.metro_area and m.active)
  );
create policy "read programs" on recurring_programs for select
  using (
    auth.role() = 'authenticated'
    and exists (select 1 from markets m where m.id = recurring_programs.metro_area and m.active)
  );

-- events: curated/materialized events (proposed_by_group is null) are visible
-- to every signed-in user, same as before. A user-proposed meetup
-- (proposed_by_group set) is only visible to — and only insertable/editable
-- by — members of that group; added_by must be the proposer themselves.
-- NOTE: unlike places/recurring_programs above, this policy is NOT gated on
-- the event's market being active (confirmed live) — an event in a
-- deactivated market stays readable even though its place/program wouldn't
-- be. Flagging as an asymmetry, not fixing it myself (RLS change).
create policy "read events" on events for select
  using (
    auth.role() = 'authenticated'
    and (proposed_by_group is null or is_member(proposed_by_group))
  );
create policy "add events" on events for insert
  with check (
    added_by = auth.uid()
    and proposed_by_group is not null
    and is_member(proposed_by_group)
  );
create policy "edit own events" on events for update
  using (added_by = auth.uid() and proposed_by_group is not null);
create policy "delete own proposed events" on events for delete
  using (added_by = auth.uid() and proposed_by_group is not null);

-- rsvps: THE key rule. You can read an RSVP if it's yours, or if you share a
-- group with the person who made it. Writes are always your own.
create policy "read own or shared rsvps" on rsvps for select
  using (user_id = auth.uid() or shares_group_with(user_id));
create policy "insert own rsvp" on rsvps for insert with check (user_id = auth.uid());
create policy "update own rsvp" on rsvps for update using (user_id = auth.uid());
create policy "delete own rsvp" on rsvps for delete using (user_id = auth.uid());

-- event_comments: flat thread, scoped to a group. Anyone can read/write
-- within a group they belong to; edit/delete stay author-only. There's no
-- policy requiring group_id to relate to the event's own proposed_by_group —
-- the app decides which group's thread it's posting/reading.
create policy "read comments in my groups" on event_comments for select
  using (is_member(group_id));
create policy "write own comments" on event_comments for insert
  with check (user_id = auth.uid() and is_member(group_id));
create policy "edit own comments" on event_comments for update
  using (user_id = auth.uid());
create policy "delete own comments" on event_comments for delete
  using (user_id = auth.uid());

-- place_tips: same group-scoped read/write shape as comments. Rows are
-- normally created via promote_comment_to_tip() (SECURITY DEFINER, so it
-- bypasses this insert policy), but the policy also allows direct inserts
-- from the app's "Add a tip" form.
create policy "read group tips" on place_tips for select
  using (is_member(group_id));
create policy "write own tips" on place_tips for insert
  with check (user_id = auth.uid() and is_member(group_id));
create policy "edit own tips" on place_tips for update
  using (user_id = auth.uid());
create policy "delete own tips" on place_tips for delete
  using (user_id = auth.uid());

-- outing_feedback: same shared-visibility shape as rsvps.
create policy "read shared feedback" on outing_feedback for select
  using (user_id = auth.uid() or shares_group_with(user_id));
create policy "write own feedback" on outing_feedback for insert
  with check (user_id = auth.uid());
create policy "update own feedback" on outing_feedback for update
  using (user_id = auth.uid());

-- availability: same group-scoped shape as event_comments/place_tips.
create policy "read group availability" on availability for select
  using (is_member(group_id));
create policy "write own availability" on availability for insert
  with check (user_id = auth.uid() and is_member(group_id));
create policy "delete own availability" on availability for delete
  using (user_id = auth.uid());

-- ---------- Realtime ------------------------------------------

alter publication supabase_realtime add table rsvps;
alter publication supabase_realtime add table event_comments;
alter publication supabase_realtime add table availability;

-- ---------- Auto-create a profile row on signup ------------

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
