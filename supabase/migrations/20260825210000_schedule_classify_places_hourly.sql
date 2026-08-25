-- Hourly place-facility enrichment using the existing mommas_cron_secret.
-- Same vault-secret + net.http_post pattern as classify-candidates.
select cron.schedule(
  'mommas-classify-places-hourly',
  '55 * * * *',
  $$select net.http_post(
      url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/classify-places',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000
    ) as request_id;$$
);
