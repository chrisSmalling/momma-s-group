-- v9: kid/toddler relevance filter for ingested events.
--
-- Communico's feed carries no structured age/audience field (confirmed
-- from real ingested raw_payload: only SUMMARY, DESCRIPTION, LOCATION,
-- DTSTART, DTEND, GEO, UID, STATUS, ORGANIZER). Both configured library
-- sources return ALL programming — mahjong, chair yoga, chess club, adult
-- events alongside toddler storytime — so ingested events need a
-- relevance filter before they're fit to show on /today or /calendar.
--
-- Strict allowlist by design: false negatives (a real kid event gets
-- hidden) are acceptable; false positives (an adult event shows up) are
-- not. Keyword set is evidence-based, derived from titles in the first
-- 765 real ingested Pasco/Hillsborough records -- not guessed. Notably
-- excludes bare "play", "little", "tot": verified false positives against
-- that same real data ("Woodworking Open Build" was the single largest
-- match on those three, 15 hits).
--
-- Filters at display time, not ingestion: is_kid_relevant is a GENERATED
-- STORED column, computed from title/venue_name/source, so ingestion
-- keeps writing every event unconditionally (cheap to keep, expensive to
-- re-fetch) and hiding stays reversible/tunable without re-ingesting.
-- Non-communico events (source is anything other than 'communico' --
-- manual entries, materialized recurring programs, user-proposed
-- meetups) always pass; the allowlist only applies to externally
-- aggregated events, which is the only place this ambiguity exists.
--
-- Tuning note: because this is STORED (Postgres 17 has no virtual
-- generated columns), changing is_kid_relevant_event()'s keyword lists
-- requires a one-time `update events set title = title` (or any no-op
-- update) afterward to force recomputation on existing rows -- newly
-- ingested/updated rows pick up the new logic automatically.
create or replace function is_kid_relevant_event(p_title text, p_venue_name text, p_source text)
returns boolean
language sql
immutable
as $$
  select case
    when p_source is distinct from 'communico' then true
    else
      coalesce(p_title ~* '(storytime|story time|lap-sit|toddler|preschool|baby|babies)', false)
      and coalesce(p_venue_name !~* '(- adult|teen room)', true)
      and coalesce(p_title !~* '(teen|adult|18\+|book club|chess|yoga|crochet|woodworking|woodturners|open build|craft & chat|painting)', true)
  end;
$$;

alter table events
  add column is_kid_relevant boolean generated always as (
    is_kid_relevant_event(title, venue_name, source)
  ) stored;

create index idx_events_kid_relevant_starts_at on events (starts_at) where is_kid_relevant;
