-- Canonical Phase 1 observability runner.
-- This is intentionally SECURITY DEFINER and executable only by service_role.
create or replace function public.record_event_pipeline_observability()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  health jsonb;
  source_row record;
  source_health text;
  reasons jsonb;
  minutes_success numeric;
  minutes_attempt numeric;
  stale_source_count integer := 0;
  critical_alerts integer := 0;
  warning_alerts integer := 0;
begin
  health := public.audit_event_pipeline_health();
  insert into public.event_pipeline_health_audit_log(health) values (health);

  for source_row in
    select cs.*,
      coalesce((select count(*) from public.event_discovery_candidates c where c.source_id=cs.id),0) as candidate_count,
      coalesce((select count(*) from public.event_discovery_candidates c where c.source_id=cs.id and c.promotion_event_id is not null),0) as promoted_count
    from public.content_sources cs
    where cs.active = true
      and cs.source_type in ('discovery','structured_web','community')
      and exists (select 1 from public.event_discovery_candidates c where c.source_id=cs.id)
  loop
    minutes_success := case when source_row.last_success_at is null then null else extract(epoch from (now()-source_row.last_success_at))/60 end;
    minutes_attempt := case when source_row.last_attempted_at is null then null else extract(epoch from (now()-source_row.last_attempted_at))/60 end;
    reasons := '[]'::jsonb;
    source_health := 'healthy';

    if source_row.last_success_at is null then
      source_health := 'warning'; reasons := reasons || jsonb_build_array('no_success_recorded');
    elsif source_row.refresh_interval_minutes is not null and minutes_success > greatest(source_row.refresh_interval_minutes * 3, 180) then
      source_health := 'critical'; reasons := reasons || jsonb_build_array('stale_success'); stale_source_count := stale_source_count + 1;
    elsif source_row.refresh_interval_minutes is not null and minutes_success > greatest(source_row.refresh_interval_minutes * 1.5, 90) then
      source_health := 'warning'; reasons := reasons || jsonb_build_array('aging_success');
    end if;

    if source_row.last_error is not null
       and source_row.last_attempted_at is not null
       and (source_row.last_success_at is null or source_row.last_attempted_at > source_row.last_success_at) then
      if source_health <> 'critical' then source_health := 'warning'; end if;
      reasons := reasons || jsonb_build_array('latest_attempt_failed');
    end if;

    insert into public.event_pipeline_source_health(
      source_id,source_name,active,refresh_interval_minutes,minutes_since_success,minutes_since_attempt,
      discovery_count,successful_event_count,rejected_event_count,candidate_count,promoted_count,source_error,
      health_status,health_reasons
    ) values (
      source_row.id,source_row.name,source_row.active,source_row.refresh_interval_minutes,minutes_success,minutes_attempt,
      coalesce(source_row.discovery_count,0),coalesce(source_row.successful_event_count,0),coalesce(source_row.rejected_event_count,0),
      source_row.candidate_count,source_row.promoted_count,source_row.last_error,source_health,reasons
    );

    if source_health='critical' then
      insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value,metadata)
      values ('critical','source_stale:'||source_row.id::text,'source',source_row.name||' has not succeeded within its expected refresh window',minutes_success,greatest(coalesce(source_row.refresh_interval_minutes,60)*3,180),jsonb_build_object('source_id',source_row.id))
      on conflict (alert_key) where resolved_at is null do nothing;
      critical_alerts := critical_alerts + 1;
    elsif source_health='warning' then
      insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value,metadata)
      values ('warning','source_warning:'||source_row.id::text,'source',source_row.name||' requires attention',minutes_success,greatest(coalesce(source_row.refresh_interval_minutes,60)*1.5,90),jsonb_build_object('source_id',source_row.id,'reasons',reasons))
      on conflict (alert_key) where resolved_at is null do nothing;
      warning_alerts := warning_alerts + 1;
    else
      update public.event_pipeline_alerts set resolved_at=now() where alert_key in ('source_stale:'||source_row.id::text,'source_warning:'||source_row.id::text) and resolved_at is null;
    end if;
  end loop;

  update public.event_pipeline_alerts a set resolved_at=now()
  where a.resolved_at is null and a.component='source'
    and not exists (
      select 1 from public.content_sources cs
      where cs.id=(a.metadata->>'source_id')::uuid and cs.active=true
        and cs.source_type in ('discovery','structured_web','community')
        and exists(select 1 from public.event_discovery_candidates c where c.source_id=cs.id)
    );

  if coalesce((health->>'high_confidence_duplicate_clusters_pending')::integer,0) > 0 then
    insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value,metadata)
    values ('critical','duplicates_pending','dedup','High-confidence duplicate clusters are pending',(health->>'high_confidence_duplicate_clusters_pending')::numeric,0,jsonb_build_object('health',health))
    on conflict (alert_key) where resolved_at is null do nothing;
    critical_alerts := critical_alerts + 1;
  else
    update public.event_pipeline_alerts set resolved_at=now() where alert_key='duplicates_pending' and resolved_at is null;
  end if;

  if coalesce((health->>'unsafe_audience_feed_events')::integer,0) > 0 then
    insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value)
    values ('critical','unsafe_feed','feed','Unsafe-audience events are visible to the feed',(health->>'unsafe_audience_feed_events')::numeric,0)
    on conflict (alert_key) where resolved_at is null do nothing;
    critical_alerts := critical_alerts + 1;
  else
    update public.event_pipeline_alerts set resolved_at=now() where alert_key='unsafe_feed' and resolved_at is null;
  end if;

  if coalesce((health->>'negative_duration_events')::integer,0) > 0
     or coalesce((health->>'event_coordinate_drift')::integer,0) > 0
     or coalesce((health->>'place_coordinate_drift')::integer,0) > 0 then
    insert into public.event_pipeline_alerts(severity,alert_key,component,message,metadata)
    values ('critical','integrity_violations','database','One or more event integrity invariants are violated',jsonb_build_object('health',health))
    on conflict (alert_key) where resolved_at is null do nothing;
    critical_alerts := critical_alerts + 1;
  else
    update public.event_pipeline_alerts set resolved_at=now() where alert_key='integrity_violations' and resolved_at is null;
  end if;

  if coalesce((health->>'promotion_attempts')::integer,0) > coalesce((health->>'promotion_links')::integer,0) then
    insert into public.event_pipeline_alerts(severity,alert_key,component,message,metric_value,threshold_value,metadata)
    values ('warning','promotion_failures','promotion','Promotion attempts exceed successful promotion links',((health->>'promotion_attempts')::numeric-(health->>'promotion_links')::numeric),0,jsonb_build_object('health',health))
    on conflict (alert_key) where resolved_at is null do nothing;
  else
    update public.event_pipeline_alerts set resolved_at=now() where alert_key='promotion_failures' and resolved_at is null;
  end if;

  return jsonb_build_object('checked_at',now(),'health',health,'stale_sources',stale_source_count,'open_critical_alerts',critical_alerts,'open_warning_alerts',warning_alerts);
end;
$function$;

revoke all on function public.record_event_pipeline_observability() from public,anon,authenticated;
grant execute on function public.record_event_pipeline_observability() to service_role;
