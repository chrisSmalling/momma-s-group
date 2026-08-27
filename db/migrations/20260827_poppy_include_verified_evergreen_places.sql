-- Make verified evergreen Places first-class Poppy candidates alongside dated events.
-- Places are represented with a short synthetic availability window so the existing
-- candidate contract can transport them without inventing an event occurrence.
create or replace view public.poppy_recommendation_candidates as
select e.id,e.title,e.display_title,e.description,e.venue_name,e.venue_display,e.address,e.location_city,e.location_state,e.location_zip,e.lat,e.lng,e.location_latitude,e.location_longitude,e.starts_at,e.ends_at,e.age_min_months,e.age_max_months,e.age_band,e.age_tags,e.cost,e.source,e.source_url,e.registration_required,e.registration_url,e.is_outdoor,e.experience_type,e.weather_fit,e.is_kid_relevant,e.verification_tier,e.verification_score,e.content_review_status,e.last_verified_at,e.place_id,e.program_id
from public.events e
where e.starts_at > now() and coalesce(e.is_suppressed,false)=false and e.status <> 'cancelled' and coalesce(e.content_review_status,'') <> 'rejected' and e.verification_tier = any(array['trusted','high']) and e.geography_tier = any(array['pasco','tampa'])
union all
select p.id,p.name,p.name,coalesce(p.toddler_notes,p.description),p.name,p.name,p.address,p.city,p.state,p.zip_code,coalesce(p.lat,p.latitude),coalesce(p.lng,p.longitude),coalesce(p.lat,p.latitude),coalesce(p.lng,p.longitude),now(),now() + interval '1 day',p.age_min_months,p.age_max_months,null::text,null::text[],p.price_note,'place',coalesce(p.source_url,p.website),false,null,p.is_outdoor,'evergreen_place',case when p.is_outdoor then 'outdoor' else 'indoor' end,true,'high',100,'keep',p.last_verified_at,p.id,null
from public.places p
where p.active=true and p.llm_verification_status='verified' and coalesce(p.lat,p.latitude) is not null and coalesce(p.lng,p.longitude) is not null;
