-- Phase 1: make indoor/outdoor a real data contract instead of relying on the
-- historical events.is_outdoor=false default.
-- Strong evidence may promote an event to outdoor, but weak evidence never
-- reclassifies an event as indoor.

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
  haystack text := lower(coalesce(p_title,'') || ' ' || coalesce(p_description,'') || ' ' || coalesce(p_venue_name,''));
begin
  if p_place_id is not null then
    select is_outdoor into place_outdoor from public.places where id = p_place_id;
    if place_outdoor is true then
      return true;
    end if;
  end if;

  -- Only classify as outdoor when the event itself contains strong outdoor
  -- signals. Do not infer indoor from the absence of an outdoor signal.
  if haystack ~ '(\m(outdoor|outside|playground|park|splash pad|water park|farm|zoo|nature trail|trail walk|hike|hiking|festival|field day|soccer|baseball|softball|football|picnic|riverwalk|waterfront)\M)' then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.set_event_setting_from_context()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Existing explicit indoor values remain indoor. Strong place/title evidence
  -- is allowed to correct the historical false default to outdoor.
  if public.infer_event_is_outdoor(new.place_id, new.title, new.description, new.venue_name) then
    new.is_outdoor := true;
  end if;
  return new;
end;
$$;

revoke all on function public.infer_event_is_outdoor(uuid,text,text,text) from public;
grant execute on function public.infer_event_is_outdoor(uuid,text,text,text) to authenticated;
revoke all on function public.set_event_setting_from_context() from public;

drop trigger if exists trg_events_setting_context on public.events;
create trigger trg_events_setting_context
before insert or update of place_id, title, description, venue_name, is_outdoor
on public.events
for each row execute function public.set_event_setting_from_context();

-- Backfill only strong-positive outdoor evidence. This is intentionally
-- monotonic: we do not mass-convert unknown events to indoor.
update public.events e
set is_outdoor = true
where e.is_outdoor = false
  and public.infer_event_is_outdoor(e.place_id, e.title, e.description, e.venue_name) = true;

-- Ensure feed_events reflects the canonical events value after the backfill.
-- feed_events is a view in the current schema, so no separate write is needed.

comment on function public.infer_event_is_outdoor(uuid,text,text,text)
is 'Phase 1 event setting classifier. Strong-positive outdoor evidence only; absence of evidence is not proof of indoor.';
