alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Existing members already know how to use the current app. Only profiles
-- created after this migration should enter the new first-run activation flow.
update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed_at is null;

create index if not exists profiles_onboarding_completed_at_idx
  on public.profiles (onboarding_completed_at);
