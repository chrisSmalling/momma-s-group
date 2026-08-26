-- Existing profiles are already activated. New profiles begin with NULL
-- and are required to complete the first-run activation flow.
update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now())
where onboarding_completed_at is null;

create index if not exists profiles_onboarding_completed_at_idx
  on public.profiles (onboarding_completed_at);
