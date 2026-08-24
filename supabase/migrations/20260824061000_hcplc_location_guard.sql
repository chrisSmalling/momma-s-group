-- HCPLC structured feed currently provides branch/room names but can carry
-- incorrect coordinates. Keep the event visible when verified, but do not
-- expose untrusted coordinates to weather/distance calculations until a
-- canonical place is linked.

create or replace view public.feed_events as
select
  e.id, coalesce(e.display_title,e.title) as title, e.description,
  coalesce(e.venue_display,e.organizer,e.venue_name) as venue,
  e.room_name,e.organizer,e.address,
  case when e.source_id='d8372c79-9c12-41fb-b79d-39118b5478b2' and e.place_id is null then null else coalesce(e.lat,e.location_latitude) end as lat,
  case when e.source_id='d8372c79-9c12-41fb-b79d-39118b5478b2' and e.place_id is null then null else coalesce(e.lng,e.location_longitude) end as lng,
  e.location_latitude,e.location_longitude,e.starts_at,e.ends_at,e.time_precision,
  (e.time_precision='date_only') as time_unknown,e.cost,
  case when e.cost is null then false else lower(trim(e.cost))=any(array['free','no cost','$0','0','free admission']) end as is_free,
  e.age_tags,e.age_min_months,e.age_max_months,e.age_band,e.is_outdoor,e.what_to_bring,
  e.registration_required,e.registration_url,e.source,e.source_id,e.source_url,e.added_by,
  e.content_status,e.geography_tier,e.experience_type,e.weather_fit,e.today_priority,
  e.discovery_priority,e.feed_score,e.classification_confidence,e.recurring_score,e.one_time_score,
  e.recurrence_pattern,e.verification_score,e.verification_tier,e.verification_reasons,
  e.content_verified_at,e.place_id,e.program_id,e.proposed_by_group,e.metro_area,e.status,e.last_verified_at
from public.events e left join public.recurring_programs r on r.id=e.program_id
where e.status='published' and e.content_status='keep' and e.is_kid_relevant and not e.is_suppressed
  and e.duplicate_of is null and e.duplicate_of_event_id is null
  and e.verification_tier in ('trusted','high') and e.verification_score>=80
  and e.last_verified_at is not null and e.last_verified_at>=now()-interval '7 days'
  and (r.id is null or public.recurrence_occurrence_matches(e.starts_at,r.rrule));
