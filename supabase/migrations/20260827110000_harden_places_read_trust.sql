-- Places are user-visible discovery data. Do not expose legacy/unverified or ungeocoded rows through authenticated client reads.
drop policy if exists "read places" on public.places;
create policy "read places" on public.places
for select to authenticated
using (
  (select auth.role()) = 'authenticated'
  and llm_verification_status = 'verified'
  and lat is not null
  and lng is not null
  and exists (
    select 1 from public.markets m
    where m.id = places.metro_area
      and m.active
  )
);
