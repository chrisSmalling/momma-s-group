-- Schedule the two enrichment stages so the needs_review/unverified
-- backlog keeps draining without manual invocation, same vault-secret +
-- net.http_post pattern as every other scheduled edge function here.
-- Hourly, offset from the existing toddler-gate/classify jobs (:20 and
-- :25) so they don't all hit the DB in the same minute.
select cron.schedule(
  'mommas-enrich-and-gate-places-hourly',
  '20 * * * *',
  $$select net.http_post(
      url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/enrich-and-gate-places',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000
    ) as request_id;$$
);

select cron.schedule(
  'mommas-enrich-and-gate-events-hourly',
  '25 * * * *',
  $$select net.http_post(
      url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/enrich-and-gate-events',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000
    ) as request_id;$$
);
