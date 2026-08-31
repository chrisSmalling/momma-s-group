-- NOT applied at migration-write time -- deliberately sequenced after
-- enrich-and-gate-events has processed the live event backlog (see
-- 20260831150000's header). Apply this only once
-- `select count(*) from events where status='published' and toddler_verification_status='unverified'`
-- is at (or acceptably near) zero, so flipping these two views on
-- `toddler_verification_status='verified'` doesn't empty the events
-- feed app-wide. Confirmed sequencing with the user 2026-08-31.
--
-- Close the gap: feed_events and poppy_recommendation_candidates both
-- already gate on verification_tier/verification_score (source trust);
-- now they also require toddler_verification_status='verified' (age/
-- content appropriateness for a toddler specifically), the same way
-- the place half of poppy_recommendation_candidates already requires
-- llm_verification_status='verified'. This is the one predicate added
-- at the one place both /today, /calendar, resolveEvent, plans, groups
-- and Poppy recommend already read from -- not three separate edits.
create or replace view public.feed_events
with (security_invoker = true) as
 SELECT e.id,
    COALESCE(e.display_title, e.title) AS title,
    e.description,
    COALESCE(e.venue_display, e.organizer, e.venue_name) AS venue,
    e.room_name,
    e.organizer,
    e.address,
        CASE
            WHEN e.source_id = 'd8372c79-9c12-41fb-b79d-39118b5478b2'::uuid AND e.place_id IS NULL THEN NULL::double precision
            ELSE COALESCE(e.lat, e.location_latitude)
        END AS lat,
        CASE
            WHEN e.source_id = 'd8372c79-9c12-41fb-b79d-39118b5478b2'::uuid AND e.place_id IS NULL THEN NULL::double precision
            ELSE COALESCE(e.lng, e.location_longitude)
        END AS lng,
    e.location_latitude,
    e.location_longitude,
    e.starts_at,
    e.ends_at,
    e.time_precision,
    e.time_precision = 'date_only'::text AS time_unknown,
    e.cost,
        CASE
            WHEN e.cost IS NULL THEN false
            ELSE lower(TRIM(BOTH FROM e.cost)) = ANY (ARRAY['free'::text, 'no cost'::text, '$0'::text, '0'::text, 'free admission'::text])
        END AS is_free,
    e.age_tags,
    e.age_min_months,
    e.age_max_months,
    e.age_band,
    e.is_outdoor,
    e.what_to_bring,
    e.registration_required,
    e.registration_url,
    e.source,
    e.source_id,
    e.source_url,
    e.added_by,
    e.content_status,
    e.geography_tier,
    e.experience_type,
    e.weather_fit,
    e.today_priority,
    e.discovery_priority,
    e.feed_score,
    e.classification_confidence,
    e.recurring_score,
    e.one_time_score,
    e.recurrence_pattern,
    e.verification_score,
    e.verification_tier,
    e.verification_reasons,
    e.content_verified_at,
    e.place_id,
    e.program_id,
    e.proposed_by_group,
    e.metro_area,
    e.status,
    e.last_verified_at,
        CASE
            WHEN e.last_verified_at >= (now() - '2 days'::interval) THEN 'verified_recently'::text
            WHEN e.last_verified_at >= (now() - '8 days'::interval) THEN 'confirmed_this_week'::text
            WHEN e.last_verified_at >= (now() - '21 days'::interval) OR e.program_id IS NOT NULL THEN 'likely_on'::text
            ELSE 'check_before_you_go'::text
        END AS currency_label,
    NOT (e.last_verified_at >= (now() - '21 days'::interval) OR e.program_id IS NOT NULL) AS needs_confirmation,
        CASE
            WHEN e.last_verified_at IS NULL THEN NULL::integer
            ELSE floor(EXTRACT(epoch FROM now() - e.last_verified_at) / 86400::numeric)::integer
        END AS last_verified_days
   FROM events e
     LEFT JOIN recurring_programs r ON r.id = e.program_id
     LEFT JOIN event_freshness_state fs ON fs.event_id = e.id
  WHERE e.status = 'published'::text AND e.is_kid_relevant AND e.content_status <> 'exclude'::text
    AND e.toddler_verification_status = 'verified'::text
    AND e.duplicate_of IS NULL AND e.duplicate_of_event_id IS NULL AND (NOT e.is_suppressed OR e.suppressed_reason IS NULL)
    AND ((e.verification_tier = ANY (ARRAY['trusted'::text, 'high'::text])) AND e.verification_score >= 80 OR e.proposed_by_group IS NOT NULL AND (EXISTS ( SELECT 1
           FROM group_members gm
          WHERE gm.group_id = e.proposed_by_group AND gm.user_id = auth.uid())))
    AND (COALESCE(fs.freshness_state, ''::text) <> ALL (ARRAY['cancelled'::text, 'expired'::text, 'completed'::text]))
    AND fs.cancellation_detected_at IS NULL
    AND NOT (e.registration_required AND (e.last_verified_at IS NULL OR e.last_verified_at < (now() - '14 days'::interval)))
    AND (r.id IS NULL OR public.recurrence_occurrence_matches(e.starts_at, r.rrule));

create or replace view public.poppy_recommendation_candidates as
 SELECT e.id,
    e.title,
    e.display_title,
    e.description,
    e.venue_name,
    e.venue_display,
    e.address,
    e.location_city,
    e.location_state,
    e.location_zip,
    e.lat,
    e.lng,
    e.location_latitude,
    e.location_longitude,
    e.starts_at,
    e.ends_at,
    e.age_min_months,
    e.age_max_months,
    e.age_band,
    e.age_tags,
    e.cost,
    e.source,
    e.source_url,
    e.registration_required,
    e.registration_url,
    e.is_outdoor,
    e.experience_type,
    e.weather_fit,
    e.is_kid_relevant,
    e.verification_tier,
    e.verification_score,
    e.content_review_status,
    e.last_verified_at,
    e.place_id,
    e.program_id,
    'event'::text AS kind,
    NULL::jsonb AS hours,
    NULL::date AS season_start,
    NULL::date AS season_end
   FROM events e
  WHERE e.starts_at > now() AND COALESCE(e.is_suppressed, false) = false AND e.status <> 'cancelled'::text
    AND COALESCE(e.content_review_status, ''::text) <> 'rejected'::text
    AND (e.verification_tier = ANY (ARRAY['trusted'::text, 'high'::text]))
    AND (e.geography_tier = ANY (ARRAY['pasco'::text, 'tampa'::text]))
    AND e.toddler_verification_status = 'verified'::text
UNION ALL
 SELECT p.id,
    p.name AS title,
    p.name AS display_title,
    COALESCE(p.toddler_notes, p.description) AS description,
    p.name AS venue_name,
    p.name AS venue_display,
    p.address,
    p.city AS location_city,
    p.state AS location_state,
    p.zip_code AS location_zip,
    COALESCE(p.lat, p.latitude) AS lat,
    COALESCE(p.lng, p.longitude) AS lng,
    COALESCE(p.lat, p.latitude) AS location_latitude,
    COALESCE(p.lng, p.longitude) AS location_longitude,
    NULL::timestamp with time zone AS starts_at,
    NULL::timestamp with time zone AS ends_at,
    p.age_min_months,
    p.age_max_months,
    NULL::text AS age_band,
    NULL::text[] AS age_tags,
    p.price_note AS cost,
    'place'::text AS source,
    COALESCE(p.source_url, p.website) AS source_url,
    NULL::boolean AS registration_required,
    NULL::text AS registration_url,
    p.is_outdoor,
    'evergreen_place'::text AS experience_type,
        CASE
            WHEN p.is_outdoor THEN 'outdoor'::text
            ELSE 'indoor'::text
        END AS weather_fit,
    true AS is_kid_relevant,
    p.llm_verification_status AS verification_tier,
    NULL::integer AS verification_score,
    NULL::text AS content_review_status,
    p.last_verified_at,
    p.id AS place_id,
    NULL::uuid AS program_id,
    'place'::text AS kind,
    p.hours,
    p.season_start,
    p.season_end
   FROM places p
  WHERE p.active = true AND p.llm_verification_status = 'verified'::text AND COALESCE(p.lat, p.latitude) IS NOT NULL AND COALESCE(p.lng, p.longitude) IS NOT NULL;
