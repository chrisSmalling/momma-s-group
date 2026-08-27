-- The HCPLC source is named for the Lutz branch but was previously configured
-- with an "all locations" iCal feed. That caused Brandon/Valrico/etc. events to
-- enter the Momma's Meetup corpus under a misleading Lutz source name.
-- Keep the source itself scoped at ingestion and quarantine already-ingested
-- out-of-scope events. The source's geographic contract must be explicit.

update public.content_sources
set source_url = 'https://attend.hcplc.org/feeds?data=eyJmZWVkVHlwZSI6ImljYWwiLCJmaWx0ZXJzIjp7ImxvY2F0aW9uIjpbIkx1dHogQnJhbmNoIExpYnJhcnkiXSwiYWdlcyI6WyJhbGwiXSwidHlwZXMiOlsiYWxsIl0sInRhZ3MiOltdLCJ0ZXJtIjoiIiwiZGF5cyI6NjB9fQ=='
where id = 'd8372c79-9c12-41fb-b79d-39118b5478b2';

update public.events
set
  is_suppressed = true,
  suppressed_reason = 'HCPLC Lutz source was incorrectly configured as all locations; event is outside the Lutz source scope.'
where source_id = 'd8372c79-9c12-41fb-b79d-39118b5478b2'
  and starts_at >= now()
  and geography_tier = 'far'
  and coalesce(is_suppressed, false) = false;
