-- Phase 3 freshness hardening
-- Production companion for reverify-due-events-v1.

create or replace function public.run_event_reverification_worker()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare request_id bigint;
begin
  select net.http_post(
    url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/reverify-due-events-v1',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  ) into request_id;
  return request_id;
end;
$$;

revoke all on function public.run_event_reverification_worker() from public, anon, authenticated;
grant execute on function public.run_event_reverification_worker() to postgres, service_role;

select cron.unschedule(jobid) from cron.job where jobname='mommas-event-freshness-every-6h';
select cron.schedule('mommas-event-reverification-every-2h','15 */2 * * *','select public.run_event_reverification_worker();');

-- Existing keep rows that are awaiting verification must not remain public.
update public.events e
set content_status='review',
    content_review_status='pending',
    content_review_reason='Freshness verification required before publication'
where e.status='published'
  and e.content_status='keep'
  and exists (
    select 1 from public.event_freshness_state s
    where s.event_id=e.id and s.freshness_state='due'
  );

-- Historical published rows must leave the active inventory once their start time has passed.
update public.events
set status='cancelled',
    content_status='exclude',
    is_kid_relevant=false,
    content_review_reason='Event start time has passed; retired by freshness lifecycle'
where status='published'
  and starts_at < now();
