-- Phase A (Poppy v2 roadmap): honest unified candidate model.
--
-- poppy_recommendation_candidates previously gave every evergreen place a
-- fabricated starts_at=now()/ends_at=now()+1day purely so it could survive
-- the route's `starts_at > now()` filter, and hardcoded verification_tier=
-- 'high', verification_score=100, content_review_status='keep',
-- registration_required=false for every place regardless of what's
-- actually known. This migration removes the fabrication: places carry a
-- real `kind` discriminator, null event-time, their own hours/season_start/
-- season_end for eligibility, and their real (if coarser) verification
-- status. Time eligibility is decided per-kind in the application layer
-- (src/lib/recommend/filter.ts), not by a single shared WHERE clause.
--
-- Deviation from the handoff brief, verified against this database rather
-- than assumed: `places.verification_tier` / `places.verification_score`
-- do not exist (only `events` has that vocabulary) — places only ever
-- carried `llm_verification_status`. That real status is passed through as
-- verification_tier below instead of a blanket constant; verification_score
-- is left null (unknown) rather than inventing a numeric equivalent that
-- doesn't exist, per the brief's own "don't default unknown facts to
-- confident values" rule.

alter table public.places
  add column if not exists season_start date,
  add column if not exists season_end date;

create or replace view public.poppy_recommendation_candidates as
select e.id,e.title,e.display_title,e.description,e.venue_name,e.venue_display,e.address,e.location_city,e.location_state,e.location_zip,e.lat,e.lng,e.location_latitude,e.location_longitude,e.starts_at,e.ends_at,e.age_min_months,e.age_max_months,e.age_band,e.age_tags,e.cost,e.source,e.source_url,e.registration_required,e.registration_url,e.is_outdoor,e.experience_type,e.weather_fit,e.is_kid_relevant,e.verification_tier,e.verification_score,e.content_review_status,e.last_verified_at,e.place_id,e.program_id,
  'event'::text as kind, null::jsonb as hours, null::date as season_start, null::date as season_end
from public.events e
where e.starts_at > now() and coalesce(e.is_suppressed,false)=false and e.status <> 'cancelled' and coalesce(e.content_review_status,'') <> 'rejected' and e.verification_tier = any(array['trusted','high']) and e.geography_tier = any(array['pasco','tampa'])
union all
select p.id,p.name,p.name,coalesce(p.toddler_notes,p.description),p.name,p.name,p.address,p.city,p.state,p.zip_code,coalesce(p.lat,p.latitude),coalesce(p.lng,p.longitude),coalesce(p.lat,p.latitude),coalesce(p.lng,p.longitude),
  null::timestamptz,null::timestamptz,
  p.age_min_months,p.age_max_months,null::text,null::text[],p.price_note,'place',coalesce(p.source_url,p.website),
  null,null,
  p.is_outdoor,'evergreen_place',case when p.is_outdoor then 'outdoor' else 'indoor' end,true,
  p.llm_verification_status,null,null,
  p.last_verified_at,p.id,null,
  'place'::text as kind, p.hours, p.season_start, p.season_end
from public.places p
where p.active=true and p.llm_verification_status='verified' and coalesce(p.lat,p.latitude) is not null and coalesce(p.lng,p.longitude) is not null;
