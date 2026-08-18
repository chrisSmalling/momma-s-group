-- ============================================================
-- activity_sources.feed_format (v8)
--
-- Small gap found while wiring up the first real adapter (PR #18.1):
-- source_type ('communico', 'rss', 'ical', ...) identifies the vendor/
-- platform an activity_sources row talks to, but a single vendor
-- (Communico) can expose the SAME underlying calendar as either an RSS
-- feed or an iCal feed — those need different parsing, independent of
-- which vendor it is. feed_format is that second, orthogonal axis.
-- Nullable: only meaningful for sources where the adapter itself supports
-- multiple feed formats (Communico does; a future single-format-only
-- adapter wouldn't need this set at all).
-- ============================================================

alter table activity_sources
  add column feed_format text check (feed_format in ('rss', 'ical'));
