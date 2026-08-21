-- Phase 1: Pipeline Command Center observability.
-- The production migration also contains the source-health noise fix; this file
-- is the canonical source-controlled record of the observability contract.

create table if not exists public.event_pipeline_source_health (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now(),
  source_id uuid references public.content_sources(id) on delete set null,
  source_name text not null,
  active boolean not null,
  refresh_interval_minutes integer,
  minutes_since_success numeric,
  minutes_since_attempt numeric,
  discovery_count bigint not null default 0,
  successful_event_count bigint not null default 0,
  rejected_event_count bigint not null default 0,
  candidate_count bigint not null default 0,
  promoted_count bigint not null default 0,
  source_error text,
  health_status text not null,
  health_reasons jsonb not null default '[]'::jsonb,
  unique(source_id, checked_at)
);

create index if not exists idx_event_pipeline_source_health_checked_at on public.event_pipeline_source_health(checked_at desc);
create index if not exists idx_event_pipeline_source_health_source_checked on public.event_pipeline_source_health(source_id, checked_at desc);

create table if not exists public.event_pipeline_alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  severity text not null check (severity in ('info','warning','critical')),
  alert_key text not null,
  component text not null,
  message text not null,
  metric_value numeric,
  threshold_value numeric,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_event_pipeline_alerts_open on public.event_pipeline_alerts(resolved_at, severity, created_at desc);
create unique index if not exists uq_event_pipeline_alert_open_key on public.event_pipeline_alerts(alert_key) where resolved_at is null;

-- Source monitoring intentionally scopes to operational discovery inputs that
-- have actually produced candidates. Raw crawl URLs and archival pages are
-- not independent pipeline jobs and must not generate operational alerts.
-- Failed attempts only matter when newer than the latest successful attempt.

create or replace view public.event_pipeline_command_center as
select
  now() as checked_at,
  (select health from public.event_pipeline_health_audit_log order by checked_at desc limit 1) as latest_health,
  (select count(*) from public.event_pipeline_alerts where resolved_at is null and severity='critical') as open_critical_alerts,
  (select count(*) from public.event_pipeline_alerts where resolved_at is null and severity='warning') as open_warning_alerts,
  (select count(*) from public.event_pipeline_source_health where checked_at=(select max(checked_at) from public.event_pipeline_source_health) and health_status='critical') as critical_sources,
  (select count(*) from public.event_pipeline_source_health where checked_at=(select max(checked_at) from public.event_pipeline_source_health) and health_status='warning') as warning_sources,
  (select count(*) from public.event_pipeline_source_health where checked_at=(select max(checked_at) from public.event_pipeline_source_health)) as active_sources;

revoke all on public.event_pipeline_command_center from anon,authenticated;
grant select on public.event_pipeline_command_center to service_role;

-- Keep the existing 15-minute scheduler on the enhanced observability runner.
select cron.unschedule('mommas-event-pipeline-health');
select cron.schedule('mommas-event-pipeline-health','*/15 * * * *','select public.record_event_pipeline_observability();');
