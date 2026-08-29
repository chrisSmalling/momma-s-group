-- Capture schema drift: get_recommendation_candidates() overloads,
-- refresh_fuzzy_event_duplicate_clusters(), and the "add events" policy
--
-- All three exist in the live database but were never captured into
-- supabase/migrations/ — the actual history lives only in db/migrations/
-- (20260826_enforce_poppy_canonical_geography.sql,
-- 20260827_poppy_geography_hard_cap_30_miles.sql,
-- 20260827_poppy_routed_radius_prefilter.sql,
-- 20260826_reconcile_runtime_hardening.sql,
-- 20260827_allow_group_creators_to_propose_events.sql), a path this repo's
-- migration runner never applies. Verified 2026-08-29 against the live
-- database via direct SQL introspection (pg_get_functiondef / pg_policies).
--
-- get_recommendation_candidates has FIVE live overloads. Older, narrower
-- signatures are kept alongside the newest one because application code may
-- still call them; this migration reproduces all five exactly as they exist
-- in production rather than picking one. `create or replace function` and
-- `drop policy if exists` + `create policy` are idempotent: a no-op against
-- production, a full create on a fresh env.

-- Oldest surviving overload: places + upcoming events, flat haversine, no
-- start/end window.
create or replace function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision DEFAULT 25, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 15)
 returns table(kind text, id uuid, name text, description text, distance_miles double precision, starts_at timestamp with time zone, price_note text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, activity_vibe text)
 language sql
 stable security definer
 set search_path to ''
as $function$ with places_q as (select 'place'::text kind,p.id,p.name,p.description,case when p.lat is not null and p.lng is not null then 3958.7613*2*asin(sqrt(power(sin(radians(p.lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(p.lat))*power(sin(radians(p.lng-p_lng)/2),2))) end distance_miles,null::timestamptz starts_at,p.price_note,p.has_changing_table,p.nursing_friendly,p.stroller_accessible,p.quiet_or_sensory_friendly,null::text activity_vibe from public.places p where p.active=true and p.llm_verification_status='verified'), events_q as (select 'event'::text kind,e.id,e.description,e.title name,case when coalesce(e.location_latitude,e.lat) is not null and coalesce(e.location_longitude,e.lng) is not null then 3958.7613*2*asin(sqrt(power(sin(radians(coalesce(e.location_latitude,e.lat)-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(coalesce(e.location_latitude,e.lat)))*power(sin(radians(coalesce(e.location_longitude,e.lng)-p_lng)/2),2))) end distance_miles,e.starts_at,e.cost price_note,null::boolean has_changing_table,null::boolean nursing_friendly,null::boolean stroller_accessible,null::boolean quiet_or_sensory_friendly,e.experience_type activity_vibe from public.events e where e.starts_at>=now() and coalesce(e.is_suppressed,false)=false and coalesce(e.content_status,'') not in ('rejected','suppressed') and (p_child_age_months is null or e.age_min_months is null or e.age_max_months is null or (p_child_age_months between e.age_min_months and e.age_max_months))), all_q as (select * from places_q union all select * from events_q), ranked as (select q.*,row_number() over(partition by q.kind,q.id order by q.distance_miles nulls last,q.starts_at nulls last) rn from all_q q) select kind,id,name,description,distance_miles,starts_at,price_note,has_changing_table,nursing_friendly,stroller_accessible,quiet_or_sensory_friendly,activity_vibe from ranked where rn=1 and (distance_miles is null or distance_miles<=greatest(0,p_max_distance_miles)) order by distance_miles nulls last,starts_at nulls last limit greatest(1,least(coalesce(p_limit,15),50)); $function$;

-- Adds an explicit p_start/p_end window on top of the previous overload.
create or replace function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_max_distance_miles double precision DEFAULT 25, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 15, p_start timestamp with time zone DEFAULT now(), p_end timestamp with time zone DEFAULT (now() + '31 days'::interval))
 returns table(kind text, id uuid, name text, description text, distance_miles double precision, starts_at timestamp with time zone, price_note text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, activity_vibe text)
 language sql
 stable security definer
 set search_path to ''
as $function$ with events_q as (select 'event'::text kind,e.id,coalesce(e.title,'') name,e.description,case when coalesce(e.location_latitude,e.lat) is not null and coalesce(e.location_longitude,e.lng) is not null then 3958.7613*2*asin(sqrt(power(sin(radians(coalesce(e.location_latitude,e.lat)-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(coalesce(e.location_latitude,e.lat)))*power(sin(radians(coalesce(e.location_longitude,e.lng)-p_lng)/2),2))) end distance_miles,e.starts_at,e.cost price_note,null::boolean has_changing_table,null::boolean nursing_friendly,null::boolean stroller_accessible,null::boolean quiet_or_sensory_friendly,e.experience_type activity_vibe from public.events e where e.starts_at>=p_start and e.starts_at<p_end and coalesce(e.is_suppressed,false)=false and coalesce(e.content_status,'') not in ('rejected','suppressed') and (p_child_age_months is null or e.age_min_months is null or e.age_max_months is null or p_child_age_months between e.age_min_months and e.age_max_months) and (p_indoor is null or e.is_outdoor is null or e.is_outdoor <> p_indoor)), places_q as (select 'place'::text kind,p.id,p.name,p.description,case when p.lat is not null and p.lng is not null then 3958.7613*2*asin(sqrt(power(sin(radians(p.lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(p.lat))*power(sin(radians(p.lng-p_lng)/2),2))) end distance_miles,null::timestamptz starts_at,p.price_note,p.has_changing_table,p.nursing_friendly,p.stroller_accessible,p.quiet_or_sensory_friendly,null::text activity_vibe from public.places p where p.active=true and p.llm_verification_status='verified' and (p_child_age_months is null or p.age_min_months is null or p.age_max_months is null or p_child_age_months between p.age_min_months and p.age_max_months) and (p_indoor is null or p.is_outdoor is null or p.is_outdoor <> p_indoor)),all_q as (select * from events_q union all select * from places_q) select kind,id,name,description,distance_miles,starts_at,price_note,has_changing_table,nursing_friendly,stroller_accessible,quiet_or_sensory_friendly,activity_vibe from all_q where distance_miles is null or distance_miles<=greatest(0,p_max_distance_miles) order by distance_miles nulls last,starts_at nulls last limit greatest(1,least(coalesce(p_limit,15),50)); $function$;

-- Widened return shape (title/venue_name/ends_at/age range/source_url), still
-- flat haversine, reads events/places directly. Predecessor of the two
-- poppy_recommendation_candidates-backed overloads below.
create or replace function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision DEFAULT 20, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 30)
 returns table(kind text, id uuid, title text, description text, venue_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, distance_miles double precision, age_min_months integer, age_max_months integer, is_outdoor boolean, weather_fit text, cost text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, source_url text)
 language sql
 stable security definer
 set search_path to ''
as $function$ with ec as (select 'event'::text kind,e.id,e.title,e.description,e.venue_name,e.starts_at,e.ends_at,case when coalesce(e.location_latitude,e.lat) is not null and coalesce(e.location_longitude,e.lng) is not null then 3958.7613*acos(least(1,greatest(-1,sin(radians(p_lat))*sin(radians(coalesce(e.location_latitude,e.lat)))+cos(radians(p_lat))*cos(radians(coalesce(e.location_latitude,e.lat)))*cos(radians(coalesce(e.location_longitude,e.lng)-p_lng))))) end distance_miles,e.age_min_months,e.age_max_months,e.is_outdoor,e.weather_fit,e.cost,null::boolean,null::boolean,null::boolean,null::boolean,e.source_url from public.events e where coalesce(e.is_suppressed,false)=false and coalesce(e.content_status,'') not in ('rejected','suppressed') and e.starts_at>=p_start and e.starts_at<p_end and (p_child_age_months is null or (coalesce(e.age_min_months,0)<=p_child_age_months and (e.age_max_months is null or e.age_max_months>=p_child_age_months))) and (p_indoor is null or e.is_outdoor is distinct from p_indoor)),pc as (select 'place'::text kind,p.id,p.name,p.description,p.name,null::timestamptz,null::timestamptz,case when coalesce(p.latitude,p.lat) is not null and coalesce(p.longitude,p.lng) is not null then 3958.7613*acos(least(1,greatest(-1,sin(radians(p_lat))*sin(radians(coalesce(p.latitude,p.lat)))+cos(radians(p_lat))*cos(radians(coalesce(p.latitude,p.lat)))*cos(radians(coalesce(p.longitude,p.lng)-p_lng))))) end distance_miles,p.age_min_months,p.age_max_months,p.is_outdoor,null::text,p.price_note,case when p.llm_verification_status='verified' then p.has_changing_table else null end,case when p.llm_verification_status='verified' then p.nursing_friendly else null end,case when p.llm_verification_status='verified' then p.stroller_accessible else null end,case when p.llm_verification_status='verified' then p.quiet_or_sensory_friendly else null end,p.website from public.places p where p.active=true and (p_child_age_months is null or (coalesce(p.age_min_months,0)<=p_child_age_months and (p.age_max_months is null or p.age_max_months>=p_child_age_months))) and (p_indoor is null or p.is_outdoor is distinct from p_indoor)) select * from (select * from ec union all select * from pc) x where distance_miles is not null and distance_miles<=p_max_distance_miles order by starts_at nulls last,distance_miles limit greatest(1,least(p_limit,100)); $function$;

-- Descends from db/migrations/20260826_enforce_poppy_canonical_geography.sql,
-- 20260827_poppy_geography_hard_cap_30_miles.sql and
-- 20260827_poppy_routed_radius_prefilter.sql: reads from
-- poppy_recommendation_candidates (the "honest unified candidate model" view
-- from 20260827195000_poppy_honest_unified_candidate_model.sql) instead of
-- events directly, uses great-circle acos distance, and caps the effective
-- radius at 45 miles. Adds accessibility need flags and an optional
-- budget_max filter. Reproduced exactly as it exists live; the precise
-- order in which those three files landed on this signature isn't re-derived
-- here.
create or replace function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision DEFAULT 20, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_needs_changing_table boolean DEFAULT false, p_needs_nursing_friendly boolean DEFAULT false, p_needs_stroller_accessible boolean DEFAULT false, p_needs_quiet_or_sensory_friendly boolean DEFAULT false, p_budget_max numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 30)
 returns table(kind text, id uuid, title text, description text, venue_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, distance_miles double precision, age_min_months integer, age_max_months integer, is_outdoor boolean, weather_fit text, cost text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, source_url text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
with event_base as (
  select p.*, coalesce(p.location_latitude,p.lat) as xlat,
         coalesce(p.location_longitude,p.lng) as xlng
  from public.poppy_recommendation_candidates p
  where p.starts_at >= p_start and p.starts_at < p_end
),
event_candidates as (
  select 'event'::text kind, e.id, e.title, e.description, e.venue_name,
         e.starts_at, e.ends_at,
         case when e.xlat is not null and e.xlng is not null then
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(e.xlat))+
             cos(radians(p_lat))*cos(radians(e.xlat))*cos(radians(e.xlng-p_lng))
           )))
         end distance_miles,
         e.age_min_months, e.age_max_months, e.is_outdoor, e.weather_fit, e.cost,
         null::boolean,null::boolean,null::boolean,null::boolean,e.source_url
  from event_base e
  where (p_child_age_months is null or
         (coalesce(e.age_min_months,0) <= p_child_age_months and
          (e.age_max_months is null or e.age_max_months >= p_child_age_months)))
    and (p_indoor is null or e.is_outdoor is distinct from p_indoor)
    and (p_budget_max is null or lower(trim(coalesce(e.cost,''))) = 'free')
),
place_base as (
  select p.*, coalesce(p.latitude,p.lat) as xlat,
         coalesce(p.longitude,p.lng) as xlng
  from public.places p
),
place_candidates as (
  select 'place'::text kind, p.id, p.name, p.description, p.name,
         null::timestamptz, null::timestamptz,
         case when p.xlat is not null and p.xlng is not null then
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(p.xlat))+
             cos(radians(p_lat))*cos(radians(p.xlat))*cos(radians(p.xlng-p_lng))
           )))
         end distance_miles,
         p.age_min_months, p.age_max_months, p.is_outdoor, null::text,
         p.price_note, p.has_changing_table, p.nursing_friendly,
         p.stroller_accessible, p.quiet_or_sensory_friendly, p.website
  from place_base p
  where p.active=true
    and p.llm_verification_status='verified'
    and (p_child_age_months is null or
         (coalesce(p.age_min_months,0) <= p_child_age_months and
          (p.age_max_months is null or p.age_max_months >= p_child_age_months)))
    and (p_indoor is null or p.is_outdoor is distinct from p_indoor)
    and (not p_needs_changing_table or p.has_changing_table=true)
    and (not p_needs_nursing_friendly or p.nursing_friendly=true)
    and (not p_needs_stroller_accessible or p.stroller_accessible=true)
    and (not p_needs_quiet_or_sensory_friendly or p.quiet_or_sensory_friendly=true)
    and (p_budget_max is null or lower(trim(coalesce(p.price_note,''))) = 'free')
)
select * from (select * from event_candidates union all select * from place_candidates) x
where distance_miles is not null
  and distance_miles <= least(greatest(coalesce(p_max_distance_miles,20),1),45)
order by starts_at nulls last, distance_miles
limit greatest(1,least(p_limit,100));
$function$;

-- Same shape as the previous overload minus p_budget_max, with a 50-mile
-- cap instead of 45. Kept alongside it because application call sites still
-- reference this signature.
create or replace function public.get_recommendation_candidates(p_lat double precision, p_lng double precision, p_start timestamp with time zone, p_end timestamp with time zone, p_max_distance_miles double precision DEFAULT 20, p_child_age_months integer DEFAULT NULL::integer, p_indoor boolean DEFAULT NULL::boolean, p_needs_changing_table boolean DEFAULT false, p_needs_nursing_friendly boolean DEFAULT false, p_needs_stroller_accessible boolean DEFAULT false, p_needs_quiet_or_sensory_friendly boolean DEFAULT false, p_limit integer DEFAULT 30)
 returns table(kind text, id uuid, title text, description text, venue_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, distance_miles double precision, age_min_months integer, age_max_months integer, is_outdoor boolean, weather_fit text, cost text, has_changing_table boolean, nursing_friendly boolean, stroller_accessible boolean, quiet_or_sensory_friendly boolean, source_url text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
with event_base as (
  select p.*, coalesce(p.location_latitude,p.lat) as xlat,
         coalesce(p.location_longitude,p.lng) as xlng
  from public.poppy_recommendation_candidates p
  where p.starts_at >= p_start and p.starts_at < p_end
),
event_candidates as (
  select 'event'::text kind, e.id, e.title, e.description, e.venue_name,
         e.starts_at, e.ends_at,
         case when e.xlat is not null and e.xlng is not null then
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(e.xlat))+
             cos(radians(p_lat))*cos(radians(e.xlat))*cos(radians(e.xlng-p_lng))
           )))
         end distance_miles,
         e.age_min_months, e.age_max_months, e.is_outdoor, e.weather_fit, e.cost,
         null::boolean, null::boolean, null::boolean, null::boolean, e.source_url
  from event_base e
  where (p_child_age_months is null or
         (coalesce(e.age_min_months,0) <= p_child_age_months and
          (e.age_max_months is null or e.age_max_months >= p_child_age_months)))
    and (p_indoor is null or e.is_outdoor is distinct from p_indoor)
),
place_base as (
  select p.*, coalesce(p.latitude,p.lat) as xlat,
         coalesce(p.longitude,p.lng) as xlng
  from public.places p
),
place_candidates as (
  select 'place'::text kind, p.id, p.name, p.description, p.name,
         null::timestamptz, null::timestamptz,
         case when p.xlat is not null and p.xlng is not null then
           3958.7613*acos(least(1,greatest(-1,
             sin(radians(p_lat))*sin(radians(p.xlat))+
             cos(radians(p_lat))*cos(radians(p.xlat))*cos(radians(p.xlng-p_lng))
           )))
         end distance_miles,
         p.age_min_months, p.age_max_months, p.is_outdoor, null::text,
         p.price_note, p.has_changing_table, p.nursing_friendly,
         p.stroller_accessible, p.quiet_or_sensory_friendly, p.website
  from place_base p
  where p.active=true
    and p.llm_verification_status='verified'
    and (p_child_age_months is null or
         (coalesce(p.age_min_months,0) <= p_child_age_months and
          (p.age_max_months is null or p.age_max_months >= p_child_age_months)))
    and (p_indoor is null or p.is_outdoor is distinct from p_indoor)
    and (not p_needs_changing_table or p.has_changing_table=true)
    and (not p_needs_nursing_friendly or p.nursing_friendly=true)
    and (not p_needs_stroller_accessible or p.stroller_accessible=true)
    and (not p_needs_quiet_or_sensory_friendly or p.quiet_or_sensory_friendly=true)
)
select * from (select * from event_candidates union all select * from place_candidates) x
where distance_miles is not null
  and distance_miles <= least(greatest(p_max_distance_miles,1),50)
order by starts_at nulls last, distance_miles
limit greatest(1,least(p_limit,100));
$function$;

-- Corresponds to db/migrations/20260826_reconcile_runtime_hardening.sql.
-- Uses pg_trgm (extensions.similarity) to cluster same-time, same-venue
-- events with near-duplicate titles for review/merge.
create or replace function public.refresh_fuzzy_event_duplicate_clusters()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  n integer := 0;
  r record;
  k text;
begin
  for r in
    select a.id a_id,b.id b_id,a.title a_title,a.starts_at a_starts_at,a.venue_name a_venue_name,
      extensions.similarity(lower(regexp_replace(a.title,'[^a-z0-9 ]','','g')),lower(regexp_replace(b.title,'[^a-z0-9 ]','','g'))) sim
    from public.events a join public.events b on a.id < b.id
      and a.status='published' and b.status='published'
      and date_trunc('minute',a.starts_at at time zone 'America/New_York')=date_trunc('minute',b.starts_at at time zone 'America/New_York')
      and lower(trim(coalesce(a.venue_name,'')))=lower(trim(coalesce(b.venue_name,'')))
    where extensions.similarity(lower(regexp_replace(a.title,'[^a-z0-9 ]','','g')),lower(regexp_replace(b.title,'[^a-z0-9 ]','','g')))>=0.88
  loop
    k:=md5(lower(regexp_replace(trim(r.a_title),'[^a-z0-9]+',' ','g'))||'|'||date(r.a_starts_at at time zone 'America/New_York')||'|'||date_trunc('minute',r.a_starts_at at time zone 'America/New_York')||'|'||lower(trim(coalesce(r.a_venue_name,''))));
    insert into public.event_duplicate_clusters(cluster_key,event_ids,confidence,reason,status)
    values(k,array[r.a_id,r.b_id],case when r.sim>=0.95 then 95 else 88 end,'Fuzzy title match with same local start time, local date, and venue','pending')
    on conflict(cluster_key) do update set event_ids=excluded.event_ids,confidence=greatest(public.event_duplicate_clusters.confidence,excluded.confidence),reason=case when excluded.confidence>public.event_duplicate_clusters.confidence then excluded.reason else public.event_duplicate_clusters.reason end,updated_at=now();
    n:=n+1;
  end loop;
  return n;
end;
$function$;

-- Corresponds to the other half of db/migrations/20260826_reconcile_runtime_hardening.sql:
-- the grant to authenticated is already captured in
-- 20260826235500_fix_group_members_rls_recursion.sql, but the anon revoke
-- was never migrated. Verified live (pg_proc.proacl) that anon/public
-- currently have no execute privilege on is_member — this makes that
-- explicit and keeps it that way on a fresh environment.
revoke execute on function public.is_member(uuid) from anon;

-- Corresponds to db/migrations/20260827_allow_group_creators_to_propose_events.sql.
-- Group creators are valid proposal authors even before their membership row
-- materializes; ordinary users still must already be members of the target group.
drop policy if exists "add events" on public.events;
create policy "add events" on public.events
for insert to authenticated
with check (
  added_by = (select auth.uid())
  and proposed_by_group is not null
  and (
    public.is_member(proposed_by_group)
    or exists (
      select 1
      from public.groups g
      where g.id = proposed_by_group
        and g.created_by = (select auth.uid())
    )
  )
);
