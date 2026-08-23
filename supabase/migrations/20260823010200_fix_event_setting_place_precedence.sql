create or replace function public.infer_event_is_outdoor(
  p_place_id uuid,
  p_title text,
  p_description text,
  p_venue_name text
)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  place_outdoor boolean;
  place_found boolean := false;
  haystack text := lower(coalesce(p_title,'') || ' ' || coalesce(p_description,'') || ' ' || coalesce(p_venue_name,''));
begin
  if p_place_id is not null then
    select true, is_outdoor into place_found, place_outdoor from public.places where id = p_place_id;
    if place_found then return coalesce(place_outdoor, false); end if;
  end if;
  if haystack ~ '(\m(outdoor|outside|playground|park|splash pad|water park|farm|zoo|nature trail|trail walk|hike|hiking|festival|field day|soccer|baseball|softball|football|picnic|riverwalk|waterfront)\M)' then return true; end if;
  return false;
end;
$$;
revoke all on function public.infer_event_is_outdoor(uuid,text,text,text) from public;
grant execute on function public.infer_event_is_outdoor(uuid,text,text,text) to authenticated;
update public.events e set is_outdoor = public.infer_event_is_outdoor(e.place_id,e.title,e.description,e.venue_name) where e.place_id is not null;
