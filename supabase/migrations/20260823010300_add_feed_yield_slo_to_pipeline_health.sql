create or replace function public.audit_event_pipeline_health()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'checked_at', now(),
    'candidates', (select count(*) from public.event_discovery_candidates),
    'promotion_attempts', (select count(*) from public.event_discovery_candidates where promotion_attempted_at is not null),
    'promotion_links', (select count(*) from public.event_discovery_candidates where promotion_event_id is not null),
    'events', (select count(*) from public.events),
    'negative_duration_events', (select count(*) from public.events where ends_at is not null and ends_at < starts_at),
    'event_coordinate_drift', (select count(*) from public.events where lat is distinct from location_latitude or lng is distinct from location_longitude),
    'place_coordinate_drift', (select count(*) from public.places where lat is distinct from latitude or lng is distinct from longitude),
    'date_only_exact_violations', (select count(*) from public.events where time_precision='date_only' and event_time_known=true),
    'duplicate_lineage_self_refs', (select count(*) from public.events where duplicate_of=id or duplicate_of_event_id=id),
    'feed_visible_duplicate_lineage', (select count(*) from public.events where status='published' and content_status='keep' and is_kid_relevant and not is_suppressed and (duplicate_of is not null or duplicate_of_event_id is not null)),
    'published_exclude_events', (select count(*) from public.events where status='published' and content_status='exclude'),
    'published_review_events', (select count(*) from public.events where status='published' and content_status='review'),
    'unsafe_audience_feed_events', (select count(*) from public.events where status='published' and content_status='keep' and is_kid_relevant and not is_suppressed and coalesce(title,'') ~* '(teen|teens|senior|high school|middle school|adult only|adults only|18\\+|21\\+)'),
    'feed_upcoming', (select count(*) from public.feed_events where starts_at >= now() and ends_at >= now()),
    'feed_next_7_days', (select count(*) from public.feed_events where starts_at >= now() and starts_at < now()+interval '7 days' and ends_at >= now()),
    'feed_today', (select count(*) from public.feed_events where starts_at >= date_trunc('day',now()) and starts_at < date_trunc('day',now())+interval '1 day' and ends_at >= now()),
    'feed_floor_target_next_7_days', 35,
    'feed_floor_healthy', (select count(*) from public.feed_events where starts_at >= now() and starts_at < now()+interval '7 days' and ends_at >= now()) >= 35
  ) into result;
  return result;
end;
$$;
revoke all on function public.audit_event_pipeline_health() from public;
