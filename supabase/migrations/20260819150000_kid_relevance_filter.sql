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
-- match on those three, 15 hits). "little" was briefly reintroduced by an
-- out-of-band schema change and removed again here after it was caught
-- against this same evidence -- see git history for the full story.
--
-- is_kid_relevant is a PLAIN column (NOT generated) -- Postgres 17 has no
-- virtual generated columns, and a STORED generated column would tie
-- every keyword-list tweak to a full-table recompute. Instead: ingestion
-- (src/lib/ingestion/ingest.ts) calls is_kid_relevant_event() via RPC and
-- writes the result explicitly on every insert/update, so the function
-- below is the single source of truth for classification logic and ONLY
-- ingestion ever needs to change if the criteria change. Display-time
-- consumers (/today, /calendar) query the public.feed_events view, not
-- this table directly -- see the migration that introduces that view.
--
-- Non-communico events (source is anything other than 'communico' --
-- manual entries, materialized recurring programs, user-proposed
-- meetups) always pass; the allowlist only applies to externally
-- aggregated events, which is the only place this ambiguity exists.
create or replace function is_kid_relevant_event(p_title text, p_venue_name text, p_source text)
returns boolean
language sql
immutable
as $$
  select case
    when p_source is distinct from 'communico' then true
    when p_title ~* '(teen|adult|18\+|book club|chess|yoga|crochet|woodwork|woodturner|open build|craft & chat|painting|mahjong|bingo|genealogy|resume)'
      then false
    when coalesce(p_venue_name, '') ~* '(- Adult|Teen Room)' then false
    when p_title ~* '(storytime|story time|lap.?sit|toddler|preschool|bab(y|ies)|sensory)'
      then true
    else false
  end;
$$;

alter table events
  add column is_kid_relevant boolean not null default false;

create index idx_events_kid_relevant_starts_at on events (starts_at) where is_kid_relevant;

-- Backfill existing rows: non-communico events become true unconditionally;
-- communico events computed via the function above.
update events set is_kid_relevant = is_kid_relevant_event(title, venue_name, source);
