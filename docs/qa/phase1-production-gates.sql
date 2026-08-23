-- Momma's Meetup Phase 1 production QA gates.
-- Run against production with a service-role/admin connection.
-- Every gate should return zero failing rows unless explicitly noted.

-- 1. Parent feed contains only canonical safe events.
select id, title
from public.feed_events
where status <> 'published'
   or content_status <> 'keep'
   or not is_kid_relevant
   or is_suppressed
   or duplicate_of is not null
   or duplicate_of_event_id is not null;

-- 2. No duplicate identity clusters in the parent feed.
select lower(trim(coalesce(title,''))) as normalized_title,
       coalesce(place_id::text, lower(trim(coalesce(venue,'')))) as location,
       (starts_at at time zone 'America/New_York')::date as local_date,
       count(*) as duplicate_count
from public.feed_events
where starts_at >= now()
group by 1,2,3
having count(*) > 1;

-- 3. Every published event has coordinates or is suppressed.
select id, title, address
from public.events
where status='published'
  and starts_at >= now()
  and (coalesce(lat,location_latitude) is null or coalesce(lng,location_longitude) is null)
  and not is_suppressed;

-- 4. Indoor/outdoor classification has both a trusted place path and a
-- strong-keyword path. The classifier must not let event text override a
-- canonical indoor place.
select * from (values
  ('outdoor_keyword', public.infer_event_is_outdoor(null,'Toddler playground meetup',null,null), true),
  ('indoor_neutral', public.infer_event_is_outdoor(null,'Storytime at Library',null,null), false),
  ('outdoor_place', public.infer_event_is_outdoor('5bd4cafb-e72a-4d33-bf03-b15cfced2873','Toddler Time',null,'Asturia Park'), true),
  ('indoor_place_precedence', public.infer_event_is_outdoor('d19706d5-8435-4413-9dd1-ab5c13564408','Outdoor-themed craft',null,'Centennial Park Branch Library'), false)
) as t(test_name,result,expected)
where result <> expected;

-- 5. Public RPC surface: SECURITY DEFINER functions must not be executable
-- by anon. Account deletion, group membership helpers, and who_is_free are
-- explicitly authenticated-only where appropriate.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prosecdef
  and has_function_privilege('anon',p.oid,'EXECUTE');

-- 6. Group membership cannot be inserted directly.
select policyname, cmd, with_check
from pg_policies
where schemaname='public' and tablename='group_members' and cmd='INSERT';
-- Expected: exactly one policy whose with_check is false.

-- 7. Feed yield SLO. This is a measurement, not a zero-failure assertion.
select
  count(*) filter (where starts_at >= now() and ends_at >= now()) as upcoming,
  count(*) filter (where starts_at >= now() and starts_at < now()+interval '7 days' and ends_at >= now()) as next_7_days,
  count(*) filter (where starts_at >= date_trunc('day',now()) and starts_at < date_trunc('day',now())+interval '1 day' and ends_at >= now()) as today
from public.feed_events;

-- 8. Source health must have no active source in a hard failure state.
select name, consecutive_failures, consecutive_zero_yield, last_error
from public.content_sources
where active
  and (consecutive_failures >= 3 or consecutive_zero_yield >= 3);

-- 9. DST regression fixture: event-local time must remain America/New_York,
-- not a hard-coded -04 offset.
select public.event_local_hour('2026-11-01 14:00:00+00'::timestamptz) as dst_regression_hour;
