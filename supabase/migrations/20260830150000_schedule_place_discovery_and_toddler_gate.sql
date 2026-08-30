-- Schedule Part 1 (discovery) and Part 2 (the toddler gate) so newly
-- discovered places keep flowing through the gate automatically, not
-- just on the manual runs done while building this. Same vault-secret +
-- net.http_post pattern as every other scheduled edge function in this
-- project (mommas_cron_secret, x-cron-secret header).
--
-- discover-places-osm runs daily, not hourly: new real playgrounds/
-- libraries/museums/water parks don't appear at hourly cadence, and it
-- makes 5 sequential requests to a free public Overpass endpoint (paced
-- 2s apart) -- no reason to hit that more than once a day. It already
-- dedupes by geographic proximity and by source_url, so a slow day (or
-- one that hits Overpass rate limits, as verified live 2026-08-30 --
-- some category queries intermittently return 429/504 on the shared
-- free instance) just means fewer inserts that run, not duplicates or
-- data loss; the next run picks up where it left off.
--
-- verify-toddler-fit runs hourly (5 minutes after the existing
-- mommas-classify-places-hourly job, so amenity extraction and the
-- toddler gate don't hammer the DB in the same minute) so any place
-- discovery adds -- or any place classify-places touches -- gets
-- gated promptly rather than sitting unverified until someone notices.
select cron.schedule(
  'mommas-discover-places-osm-daily',
  '30 9 * * *',
  $$select net.http_post(
      url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/discover-places-osm',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000
    ) as request_id;$$
);

select cron.schedule(
  'mommas-verify-toddler-fit-hourly',
  '0 * * * *',
  $$select net.http_post(
      url := 'https://uiuibwufzhirpntdtqpj.supabase.co/functions/v1/verify-toddler-fit',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='mommas_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000
    ) as request_id;$$
);
