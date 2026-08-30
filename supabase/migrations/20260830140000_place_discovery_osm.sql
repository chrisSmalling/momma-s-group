-- Part 1 of the place-discovery ticket: a real, provenance-tracked
-- discovery source. There is no Google Places / business-directory API
-- credential in this project's vault (only gemini_key and
-- mommas_cron_secret exist -- confirmed live 2026-08-30) and none should
-- be fabricated, so this uses OpenStreetMap Overpass (free, keyless,
-- real municipal/community-mapped data) for the categories it actually
-- covers well: playgrounds, splash pads / water parks, libraries,
-- museums, nature reserves. Toddler gyms, indoor play franchises,
-- gymnastics/dance studios, farms and kids-class businesses are NOT
-- well represented in OSM tagging -- those stay thin on purpose rather
-- than being padded with guesses; see place_category_coverage_report()
-- below, which reports them as below target so the gap stays visible
-- in the product rather than only in a chat transcript.
--
-- Every discovered place still goes through the SAME toddler gate as
-- everything else (apply_place_toddler_gate / verify-toddler-fit) before
-- it can surface anywhere -- discovery only proposes candidates with
-- honest provenance and a factual, evidence-quotable description; it
-- never decides toddler-appropriateness itself.

-- Dedup guard: is there already an active place within ~200m of this
-- candidate? Real duplicates in a metro-scale POI dataset are almost
-- always within a much tighter radius than that (the same physical
-- playground/library won't have two entries 200m apart), so this alone
-- is a reasonable geographic dedup signal on top of the pre-existing
-- places_source_url_unique index (which already blocks re-inserting the
-- exact same OSM node/way on a repeat discovery run).
create or replace function public.place_discovery_duplicate_exists(p_lat double precision, p_lng double precision)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.places p
    where p.active = true
      and coalesce(p.lat, p.latitude) is not null
      and coalesce(p.lng, p.longitude) is not null
      and p_lat is not null and p_lng is not null
      and 1609.34 * 3958.7613 * 2 * asin(sqrt(
            power(sin(radians(coalesce(p.lat, p.latitude) - p_lat) / 2), 2)
            + cos(radians(p_lat)) * cos(radians(coalesce(p.lat, p.latitude)))
              * power(sin(radians(coalesce(p.lng, p.longitude) - p_lng) / 2), 2)
          )) <= 200
  );
$function$;

revoke all on function public.place_discovery_duplicate_exists(double precision, double precision) from public;
grant execute on function public.place_discovery_duplicate_exists(double precision, double precision) to service_role;

-- Per-category coverage against the launch metro, verified places only
-- (an unverified or needs_review row doesn't make Poppy/search less
-- thin -- only a verified one does, per this feature's own guardrail
-- against padding coverage without real gating). Targets are a rough
-- launch bar, not a quota to hit by relaxing the gate.
create or replace function public.place_category_coverage_report()
returns table(category text, verified_count integer, target integer, below_target boolean)
language sql
stable
security definer
set search_path to ''
as $function$
  with targets(category, target) as (
    values
      ('playground', 15),
      ('outdoor', 15),
      ('indoor', 10),
      ('water_play', 5),
      ('storytime', 8),
      ('animals', 5),
      ('arts_learning', 5),
      ('active_play', 5),
      ('sensory_play', 3),
      -- Not sourced by OSM discovery -- business listings, not mapped
      -- infrastructure. Zero here is an honest gap report, not a bug.
      ('toddler_gym', 5),
      ('gymnastics', 3),
      ('farm', 3),
      ('kids_class', 5)
  ),
  counts as (
    select unnest(p.category_tags) as category, count(*) as verified_count
    from public.places p
    where p.active = true and p.llm_verification_status = 'verified'
    group by 1
  )
  select t.category, coalesce(c.verified_count, 0)::integer, t.target,
         coalesce(c.verified_count, 0) < t.target as below_target
  from targets t
  left join counts c on c.category = t.category
  order by below_target desc, t.category;
$function$;

revoke all on function public.place_category_coverage_report() from public;
grant execute on function public.place_category_coverage_report() to service_role;
grant execute on function public.place_category_coverage_report() to authenticated;
