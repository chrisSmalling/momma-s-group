-- Companion to the discover-places-osm business/activity tag widening:
-- adds 'dance' and 'music' to the coverage report so those newly-covered
-- categories show real counts instead of being invisible (they didn't
-- exist as tracked categories at all before this).
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
      ('toddler_gym', 5),
      ('gymnastics', 3),
      ('farm', 3),
      ('kids_class', 5),
      ('dance', 3),
      ('music', 3)
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
