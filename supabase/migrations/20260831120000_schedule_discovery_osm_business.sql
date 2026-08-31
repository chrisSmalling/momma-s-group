-- Schedules the new discover-places-osm-business function (split out of
-- discover-places-osm -- see that migration's sibling comment and the
-- function's own header for why: running all 14 OSM tag categories in
-- one invocation hit Supabase's edge function compute limit
-- (WORKER_RESOURCE_LIMIT) partway through, verified live 2026-08-31).
-- Staggered 20 minutes after the original discovery job so the two
-- don't compete for the same free Overpass endpoint at the same moment.
select cron.schedule(
  'mommas-discover-places-osm-business-daily',
  '50 9 * * *',
  $$select net.http_post(
      url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/discover-places-osm-business',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 250000
    ) as request_id;$$
);
