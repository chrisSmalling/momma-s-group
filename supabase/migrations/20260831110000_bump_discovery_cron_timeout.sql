-- discover-places-osm now queries 14 OSM tag categories sequentially
-- (widened from 5 for business/activity coverage), so its daily cron
-- job's timeout_milliseconds needs headroom to match -- captures the
-- live cron.alter_job() done alongside the widening.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'mommas-discover-places-osm-daily'),
  command := $$select net.http_post(
      url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/discover-places-osm',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 400000
    ) as request_id;$$
);
