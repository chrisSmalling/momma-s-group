alter table public.profiles
  add column if not exists home_street text,
  add column if not exists home_city text,
  add column if not exists home_state text,
  add column if not exists home_zip text;

comment on column public.profiles.home_street is 'Member-entered home street address.';
comment on column public.profiles.home_city is 'Member-entered home city.';
comment on column public.profiles.home_state is 'Member-entered two-letter home state code.';
comment on column public.profiles.home_zip is 'Member-entered home ZIP code.';
