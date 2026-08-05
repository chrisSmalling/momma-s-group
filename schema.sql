-- ============================================================
-- Momma's Meetup — Postgres schema for Supabase
-- Run this in the Supabase SQL Editor.
-- Auth users are managed by Supabase in auth.users; we reference them.
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

create table events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  venue_name   text,
  address      text,
  lat          double precision,
  lng          double precision,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  age_tags     text[] not null default '{}',
  cost         text,                              -- null = free, else e.g. '$15'
  source       text not null default 'manual',    -- manual | communico | libcal | rss
  source_url   text,
  added_by     uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- One row per person per event. This is the whole trick: an RSVP belongs to a
-- PERSON, not a group, so every group that person is in can see it.
create table rsvps (
  event_id    uuid not null references events(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null check (status in ('going', 'maybe')),
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

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

-- ---------- Row-Level Security ------------------------------

alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;
alter table events        enable row level security;
alter table rsvps         enable row level security;

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

-- events: shared calendar visible to any signed-in user (tighten later if needed)
create policy "read events" on events for select using (auth.role() = 'authenticated');
create policy "add events" on events for insert with check (added_by = auth.uid());
create policy "edit own events" on events for update using (added_by = auth.uid());

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
