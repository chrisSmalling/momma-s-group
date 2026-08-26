-- Poppy recommendation foundation
-- --------------------------------
-- Adds the personalization fields the server-side recommendation path reads,
-- plus a per-user response cache and an audit trail for diagnosing
-- recommendation quality. Everything here is additive and idempotent
-- (add column if not exists / create table if not exists) so it is safe to
-- re-run and cannot drop or rewrite existing data.
--
-- Design notes:
--  * No new taxonomy is introduced. Ranking reuses the taxonomy the
--    discovery pipeline already populates (places.category_tags/place_type,
--    feed_events.experience_type/weather_fit/age_min_months/age_max_months).
--  * The recommendation endpoint runs under the *user's* authenticated
--    client (anon key + user JWT), never the service role. Every table below
--    is RLS-scoped to auth.uid() so one member can never read or write
--    another member's cache or audit rows.

-- ---------- 1. Profile personalization fields ----------------------------
-- child_age_months, home_lat/home_lng, nap_start/nap_end, home_* already
-- exist (see earlier migrations) and are intentionally NOT duplicated here.

alter table public.profiles
  add column if not exists child_name                 text,
  add column if not exists child_interests            text[] not null default '{}',
  add column if not exists child_activity_preferences text[] not null default '{}',
  add column if not exists family_budget_note         text,
  add column if not exists preferred_categories       text[] not null default '{}',
  add column if not exists preferred_place_types       text[] not null default '{}',
  add column if not exists indoor_preference          text default 'either',
  add column if not exists max_distance_miles         integer,
  add column if not exists discovery_view             text default 'poppy';

-- Constrain the enum-like columns. Done as NOT VALID + VALIDATE-free ADDs
-- guarded by a existence check so re-runs don't error on the duplicate
-- constraint name.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_indoor_preference_check') then
    alter table public.profiles
      add constraint profiles_indoor_preference_check
      check (indoor_preference in ('indoor', 'outdoor', 'either'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_discovery_view_check') then
    alter table public.profiles
      add constraint profiles_discovery_view_check
      check (discovery_view in ('poppy', 'list'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_max_distance_miles_check') then
    alter table public.profiles
      add constraint profiles_max_distance_miles_check
      check (max_distance_miles is null or (max_distance_miles > 0 and max_distance_miles <= 200));
  end if;
end $$;

comment on column public.profiles.child_name is
  'Optional first name Poppy uses to personalize copy. Never sent to any external model.';
comment on column public.profiles.child_interests is
  'Selectable interest tags (animals, water, trains, etc.) used as a ranking signal, never a hard filter.';
comment on column public.profiles.child_activity_preferences is
  'Preferred activity styles (e.g. playground, storytime) used as a ranking signal.';
comment on column public.profiles.family_budget_note is
  'Free-text budget context (e.g. "trying to keep it free/cheap"). Parsed for a soft budget-preference signal.';
comment on column public.profiles.preferred_categories is
  'Preferred place category_tags. Ranking signal aligned to the existing places taxonomy.';
comment on column public.profiles.preferred_place_types is
  'Preferred places.place_type values. Ranking signal.';
comment on column public.profiles.indoor_preference is
  'indoor | outdoor | either. A soft ranking signal by default; only a hard filter when the request itself is explicit.';
comment on column public.profiles.max_distance_miles is
  'Default distance ceiling (miles) for recommendations. Null means no default cap.';
comment on column public.profiles.discovery_view is
  'Which discovery experience the member prefers: poppy (assistant) or list.';

-- ---------- 2. Per-user recommendation cache -----------------------------
create table if not exists public.poppy_recommendation_cache (
  cache_key   text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  response    jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists poppy_cache_user_idx    on public.poppy_recommendation_cache (user_id);
create index if not exists poppy_cache_expires_idx on public.poppy_recommendation_cache (expires_at);

alter table public.poppy_recommendation_cache enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'poppy_recommendation_cache' and policyname = 'read own poppy cache') then
    create policy "read own poppy cache" on public.poppy_recommendation_cache
      for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'poppy_recommendation_cache' and policyname = 'write own poppy cache') then
    create policy "write own poppy cache" on public.poppy_recommendation_cache
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'poppy_recommendation_cache' and policyname = 'refresh own poppy cache') then
    create policy "refresh own poppy cache" on public.poppy_recommendation_cache
      for delete using (user_id = auth.uid());
  end if;
end $$;

comment on table public.poppy_recommendation_cache is
  'Short-lived per-user cache of Poppy recommendation responses. RLS scopes every row to its owner so a personalized response can never leak to another user. cache_key already embeds the user id plus the normalized request, profile signals, location, time window and an inventory day-stamp.';

-- Expired-entry cleanup. SECURITY DEFINER so a scheduled job (or any caller)
-- prunes globally without needing per-row RLS visibility; it only ever
-- deletes rows already past expiry.
create or replace function public.prune_expired_poppy_cache()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.poppy_recommendation_cache where expires_at < now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_expired_poppy_cache() from public, anon, authenticated;

-- ---------- 3. Recommendation audit -------------------------------------
create table if not exists public.poppy_recommendation_audit (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  request         jsonb not null,
  candidate_count integer not null default 0,
  filtered_out    integer not null default 0,
  returned        jsonb not null default '[]'::jsonb,
  cache_hit       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists poppy_audit_user_idx    on public.poppy_recommendation_audit (user_id, created_at desc);

alter table public.poppy_recommendation_audit enable row level security;

-- Insert-only for the owner. Deliberately NO select policy for
-- authenticated users: audit internals (scores, filtered counts) are for
-- developers via the service role / dashboard, never surfaced to members.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'poppy_recommendation_audit' and policyname = 'insert own poppy audit') then
    create policy "insert own poppy audit" on public.poppy_recommendation_audit
      for insert with check (user_id = auth.uid());
  end if;
end $$;

comment on table public.poppy_recommendation_audit is
  'Per-request diagnostic trail: normalized request, candidate/filter counts, and the ranked ids+scores returned. Insert-only under RLS; not readable by end users.';
