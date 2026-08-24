alter table public.profiles
  add column if not exists home_address text;

comment on column public.profiles.home_address is
  'Member-entered home address. This is the user-facing source of truth for personalized distance; coordinates, when present, are internal geocoding/cache values only.';
