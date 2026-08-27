-- Phase 2 (Poppy v2 handoff): persisted per-user exposure history so
-- Today's "Good options for your family" can rotate places instead of
-- showing the same static distance-sorted top 5 forever. One row per
-- (user, place) they've been shown; last_shown_at + consecutive_days feed
-- src/lib/recommend/exposure.ts's capped rotation penalty.
create table if not exists public.place_exposure (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  last_shown_at date not null,
  consecutive_days integer not null default 1,
  primary key (user_id, place_id)
);

alter table public.place_exposure enable row level security;

-- Same "own row" shape as group_members_update_policy - a user can only
-- ever see or write their own exposure history.
create policy "read own place exposure" on public.place_exposure for select
  using (user_id = (select auth.uid()));
create policy "write own place exposure" on public.place_exposure for insert
  with check (user_id = (select auth.uid()));
create policy "update own place exposure" on public.place_exposure for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
