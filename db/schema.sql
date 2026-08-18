-- ============================================================
-- Momma's Meetup — Postgres schema for Supabase (v2)
-- Run this in the Supabase SQL Editor.
-- Auth users are managed by Supabase in auth.users; we reference them.
--
-- v2 adds `places` (curated venues with open hours — nothing to RSVP to
-- directly) and `recurring_programs` (a recurring class/open-play slot at a
-- place, expanded into real `events` rows by materialize_programs()), plus
-- new columns on `events` for that: place_id, program_id, status,
-- registration_required/url, age_min/max_months, and proposed_by_group for
-- user-proposed meetups. This file mirrors the live schema; it is not
-- re-run against the existing project.
-- ============================================================

-- ---------- Tables ------------------------------------------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_color  text not null default '#C0356E',
  created_at    timestamptz not null default now()
);

create table groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  invite_code  text not null unique default encode(gen_random_bytes(5), 'hex'),
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

create table group_members (
  group_id   uuid not null references groups(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- A venue with open hours — nothing scheduled, nothing to RSVP to. Curated
-- (fed in by hand or a scraper), not user-generated.
create table places (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  address         text,
  lat             double precision,
  lng             double precision,
  metro_area      text not null default 'tampa_bay',
  hours           jsonb,                     -- e.g. {"mon": "10:00-21:00", ...}
  description     text,
  toddler_notes   text,
  price_note      text,
  age_min_months  int,
  age_max_months  int,
  website         text,
  booking_url     text,
  phone           text,
  source_url      text,
  last_verified_at timestamptz,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
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
  metro_area            text not null default 'tampa_bay',
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
  metro_area             text not null default 'tampa_bay',
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
  last_verified_at       timestamptz
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
  status      text not null check (status in ('going', 'maybe')),
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index idx_rsvps_user on rsvps (user_id);
create index idx_group_members_user on group_members (user_id);

-- ---------- Helper functions --------------------------------

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

-- ---------- Row-Level Security ------------------------------

alter table profiles           enable row level security;
alter table groups             enable row level security;
alter table group_members      enable row level security;
alter table places             enable row level security;
alter table recurring_programs enable row level security;
alter table events             enable row level security;
alter table rsvps              enable row level security;

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

-- places, recurring_programs: curated read-only reference data, no user writes.
create policy "read places" on places for select using (auth.role() = 'authenticated');
create policy "read programs" on recurring_programs for select using (auth.role() = 'authenticated');

-- events: curated/materialized events (proposed_by_group is null) are visible
-- to every signed-in user, same as before. A user-proposed meetup
-- (proposed_by_group set) is only visible to — and only insertable/editable
-- by — members of that group; added_by must be the proposer themselves.
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
