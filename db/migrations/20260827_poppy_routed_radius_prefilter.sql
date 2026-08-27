-- Poppy uses real routing for the final 45-minute eligibility gate.
-- The SQL layer is a conservative 45-mile prefilter so valid ~45-minute
-- candidates are not discarded before routing. It must never be presented
-- to users as a 45-minute guarantee.
CREATE OR REPLACE FUNCTION public.get_recommendation_candidates(
  p_lat double precision,
  p_lng double precision,
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_max_distance_miles double precision DEFAULT 20,
  p_child_age_months integer DEFAULT NULL,
  p_indoor boolean DEFAULT NULL,
  p_needs_changing_table boolean DEFAULT false,
  p_needs_nursing_friendly boolean DEFAULT false,
  p_needs_stroller_accessible boolean DEFAULT false,
  p_needs_quiet_or_sensory_friendly boolean DEFAULT false,
  p_budget_max numeric DEFAULT NULL,
  p_limit integer DEFAULT 30
)
RETURNS TABLE(
  kind text, id uuid, title text, description text, venue_name text,
  starts_at timestamp with time zone, ends_at timestamp with time zone,
  distance_miles double precision, age_min_months integer, age_max_months integer,
  is_outdoor boolean, weather_fit text, cost text, has_changing_table boolean,
  nursing_friendly boolean, stroller_accessible boolean,
  quiet_or_sensory_friendly boolean, source_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
WITH event_base AS (
  SELECT p.*, coalesce(p.location_latitude,p.lat) AS xlat,
         coalesce(p.location_longitude,p.lng) AS xlng
  FROM public.poppy_recommendation_candidates p
  WHERE p.starts_at >= p_start AND p.starts_at < p_end
),
event_candidates AS (
  SELECT 'event'::text kind, e.id, e.title, e.description, e.venue_name,
         e.starts_at, e.ends_at,
         CASE WHEN e.xlat IS NOT NULL AND e.xlng IS NOT NULL THEN
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(e.xlat))+
             cos(radians(p_lat))*cos(radians(e.xlat))*cos(radians(e.xlng-p_lng))
           ))) END distance_miles,
         e.age_min_months, e.age_max_months, e.is_outdoor, e.weather_fit, e.cost,
         NULL::boolean,NULL::boolean,NULL::boolean,NULL::boolean,e.source_url
  FROM event_base e
  WHERE (p_child_age_months IS NULL OR
         (coalesce(e.age_min_months,0) <= p_child_age_months AND
          (e.age_max_months IS NULL OR e.age_max_months >= p_child_age_months)))
    AND (p_indoor IS NULL OR e.is_outdoor IS DISTINCT FROM p_indoor)
    AND (p_budget_max IS NULL OR lower(trim(coalesce(e.cost,''))) = 'free')
),
place_base AS (
  SELECT p.*, coalesce(p.latitude,p.lat) AS xlat,
         coalesce(p.longitude,p.lng) AS xlng
  FROM public.places p
),
place_candidates AS (
  SELECT 'place'::text kind, p.id, p.name, p.description, p.name,
         NULL::timestamptz, NULL::timestamptz,
         CASE WHEN p.xlat IS NOT NULL AND p.xlng IS NOT NULL THEN
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(p.xlat))+
             cos(radians(p_lat))*cos(radians(p.xlat))*cos(radians(p.xlng-p_lng))
           ))) END distance_miles,
         p.age_min_months, p.age_max_months, p.is_outdoor, NULL::text,
         p.price_note, p.has_changing_table, p.nursing_friendly,
         p.stroller_accessible, p.quiet_or_sensory_friendly, p.website
  FROM place_base p
  WHERE p.active=true
    AND p.llm_verification_status='verified'
    AND (p_child_age_months IS NULL OR
         (coalesce(p.age_min_months,0) <= p_child_age_months AND
          (p.age_max_months IS NULL OR p.age_max_months >= p_child_age_months)))
    AND (p_indoor IS NULL OR p.is_outdoor IS DISTINCT FROM p_indoor)
    AND (NOT p_needs_changing_table OR p.has_changing_table=true)
    AND (NOT p_needs_nursing_friendly OR p.nursing_friendly=true)
    AND (NOT p_needs_stroller_accessible OR p.stroller_accessible=true)
    AND (NOT p_needs_quiet_or_sensory_friendly OR p.quiet_or_sensory_friendly=true)
    AND (p_budget_max IS NULL OR lower(trim(coalesce(p.price_note,''))) = 'free')
)
SELECT * FROM (SELECT * FROM event_candidates UNION ALL SELECT * FROM place_candidates) x
WHERE distance_miles IS NOT NULL
  AND distance_miles <= least(greatest(coalesce(p_max_distance_miles,20),1),45)
ORDER BY starts_at NULLS LAST, distance_miles
LIMIT greatest(1,least(p_limit,100));
$$;

TRUNCATE TABLE public.recommendation_response_cache;
