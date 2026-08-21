CREATE OR REPLACE FUNCTION public.materialize_programs(days_ahead integer DEFAULT 60)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  p            record;
  d            date;
  dow_token    text;
  made         int := 0;
  local_start  timestamptz;
begin
  for p in select * from public.recurring_programs where active loop
    d := current_date;
    while d <= current_date + days_ahead loop
      dow_token := case extract(dow from d)
        when 0 then 'SU' when 1 then 'MO' when 2 then 'TU' when 3 then 'WE'
        when 4 then 'TH' when 5 then 'FR' else 'SA' end;

      if p.rrule like '%' || dow_token || '%'
         and (p.season_start is null or d >= p.season_start)
         and (p.season_end   is null or d <= p.season_end) then

        local_start := (d::text || ' ' || p.start_time::text)::timestamp
                         at time zone 'America/New_York';

        insert into public.events (
          title, description, venue_name, address, starts_at, ends_at,
          age_tags, age_min_months, age_max_months, cost,
          source, source_url, external_id, program_id,
          registration_required, registration_url, metro_area, last_verified_at
        ) values (
          p.title, p.description, p.venue_name, p.address,
          local_start, local_start + (p.duration_minutes || ' minutes')::interval,
          case when p.age_label is null then '{}'::text[] else array[p.age_label] end,
          p.age_min_months, p.age_max_months, p.cost,
          p.source, p.source_url,
          'prog:' || p.id::text || ':' || d::text,
          p.id, p.registration_required, p.registration_url,
          p.metro_area, p.last_verified_at
        )
        on conflict (source, external_id) where source_id is null and external_id is not null
        do update set
          title = excluded.title,
          description = excluded.description,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          cost = excluded.cost,
          last_verified_at = excluded.last_verified_at;

        made := made + 1;
      end if;
      d := d + 1;
    end loop;
  end loop;
  return made;
end;
$function$;

CREATE OR REPLACE FUNCTION public.maintain_event_pipeline()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  cancelled_stale integer := 0;
  stale_candidates integer := 0;
  over_window integer := 0;
begin
  update public.events
     set status = 'cancelled'
   where starts_at < now()
     and coalesce(status,'') = 'published';
  get diagnostics cancelled_stale = row_count;

  update public.event_discovery_candidates
     set status = 'excluded', content_type = 'exclude', content_type_confidence = 0.999, content_type_reason = 'maintenance_90_day_window'
   where starts_at > now() + interval '90 days'
     and status not in ('published','excluded')
     and coalesce(candidate_status,'') not in ('promoted','duplicate');
  get diagnostics over_window = row_count;

  update public.event_discovery_candidates
     set status = 'excluded', content_type = 'exclude', content_type_confidence = 0.999, content_type_reason = 'maintenance_past_event'
   where starts_at < now()
     and status not in ('published','excluded')
     and coalesce(candidate_status,'') not in ('promoted','duplicate');
  get diagnostics stale_candidates = row_count;

  return jsonb_build_object(
    'cancelled_stale_published_events',cancelled_stale,
    'excluded_over_90_days',over_window,
    'excluded_stale_candidates',stale_candidates,
    'ran_at',now()
  );
end;
$function$;
