-- Hourly cron for the new classify-candidates edge function. Same
-- vault-secret + net.http_post pattern the discover-local-events crons use
-- (mommas_cron_secret, x-cron-secret header) — no new secret introduced.
-- Runs at :50 to avoid the other hourly jobs clustered at :05/:12/:17/:25/:40.
-- timeout_milliseconds is generous (200 events, batched 10-at-a-time with a
-- 4.5s pace between Gemini calls, can run a few minutes end to end).
select cron.schedule(
  'mommas-classify-candidates-hourly',
  '50 * * * *',
  $$select net.http_post(
      url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/classify-candidates',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    ) as request_id;$$
);
