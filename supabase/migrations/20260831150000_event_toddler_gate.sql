-- Part 2 of the enrichment ticket: events get their own toddler-
-- appropriateness gate, parallel to places' apply_place_toddler_gate,
-- so "is_kid_relevant" (a general not-inappropriate-for-kids flag --
-- confirmed live: apply_event_enrichment/classify-candidates already
-- owns that column and llm_enriched_at/llm_model for unrelated
-- content-type classification) stops being the only bar an event has
-- to clear before reaching a toddler's calendar.
--
-- Dedicated NEW columns, not a reuse of llm_enriched_at/llm_model --
-- reusing those would collide with apply_event_enrichment's existing
-- "already processed" cursor semantics exactly the way llm_verification_status
-- collided with amenity extraction on places before 20260830120000 fixed it.
--
-- Schema + functions ONLY in this migration -- purely additive, no
-- visible effect on any current query. The view changes that actually
-- gate feed_events/poppy_recommendation_candidates on this new column
-- are a deliberately separate follow-up migration
-- (20260831160000_gate_feed_events_and_poppy_candidates.sql), applied
-- only after enrich-and-gate-events has run the live backlog down --
-- every event defaults to 'unverified', so gating the views before
-- that would empty the events feed app-wide. Confirmed with the user
-- 2026-08-31.
alter table public.events
  add column if not exists toddler_verification_status text not null default 'unverified'
    check (toddler_verification_status in ('unverified','verified','needs_review','rejected')),
  add column if not exists toddler_verified_at timestamptz,
  add column if not exists toddler_gate_model text,
  add column if not exists toddler_gate_provenance jsonb not null default '{}'::jsonb;

create index if not exists events_toddler_verification_status_idx
  on public.events (toddler_verification_status) where status = 'published';

-- Deterministic hard-reject, same pattern/word list as
-- place_hard_reject_reason -- free, no LLM call, catches the obvious
-- adult-oriented/age-restricted cases before spending anything on them.
create function public.event_hard_reject_reason(p_title text, p_description text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_title ~* '\y(brewery|brewing( co)?|brew ?pub|winery|wine bar|distillery|taproom|nightclub|night club|casino|strip club|adult entertainment|cigar lounge|vape shop|smoke shop|hookah|trivia night|bar crawl|happy hour)\y'
      then 'title indicates an adult-oriented event type'
    when p_description ~* '\y(21\+|18\+|21 and (up|older)|18 and (up|older)|must be (18|21)|adults[- ]only|no children|no minors|no kids allowed|age[- ]restricted)\y'
      then 'description states an age restriction incompatible with toddlers'
    else null
  end;
$function$;

revoke all on function public.event_hard_reject_reason(text, text) from public;
revoke execute on function public.event_hard_reject_reason(text, text) from anon;
revoke execute on function public.event_hard_reject_reason(text, text) from authenticated;
grant execute on function public.event_hard_reject_reason(text, text) to service_role;

-- Mirrors apply_place_toddler_gate exactly: a verdict of
-- verified/rejected requires a grounded quote (place_evidence_supported's
-- substring check, reused as-is) or it downgrades to needs_review.
-- Same evidence-widening as the place-side gate (20260831130000): an
-- optional freshly-fetched evidence_text extends what a quote can be
-- grounded in beyond the stored description.
create function public.apply_event_toddler_gate(
  p_event_id uuid,
  p_verdict text,
  p_age_min_months integer,
  p_age_max_months integer,
  p_verdict_quote text,
  p_age_quote text,
  p_reasoning text,
  p_model text,
  p_evidence_text text default null,
  p_evidence_source_url text default null
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_description text;
  v_evidence_corpus text;
  v_final_verdict text;
  v_evidence jsonb;
begin
  if p_verdict not in ('verified','needs_review','rejected') then
    raise exception 'invalid verdict %', p_verdict using errcode = '22023';
  end if;

  select description into v_description from public.events where id = p_event_id;
  if not found then
    return null;
  end if;

  v_evidence_corpus := coalesce(v_description, '')
    || case when p_evidence_text is not null and btrim(p_evidence_text) <> ''
         then E'\n' || p_evidence_text else '' end;

  if p_verdict in ('verified','rejected')
     and not public.place_evidence_supported(v_evidence_corpus, p_verdict_quote) then
    v_final_verdict := 'needs_review';
  else
    v_final_verdict := p_verdict;
  end if;

  v_evidence := jsonb_build_object(
    'verdict', v_final_verdict,
    'claimed_verdict', p_verdict,
    'verdict_quote', p_verdict_quote,
    'age_quote', p_age_quote,
    'reasoning', p_reasoning,
    'model', p_model,
    'checked_at', now(),
    'evidence_source_url', p_evidence_source_url,
    'used_fetched_evidence', p_evidence_text is not null and btrim(p_evidence_text) <> ''
  );

  update public.events set
    toddler_verification_status = v_final_verdict,
    age_min_months = case
      when p_age_min_months is not null and public.place_evidence_supported(v_evidence_corpus, p_age_quote)
      then coalesce(age_min_months, p_age_min_months) else age_min_months end,
    age_max_months = case
      when p_age_max_months is not null and public.place_evidence_supported(v_evidence_corpus, p_age_quote)
      then coalesce(age_max_months, p_age_max_months) else age_max_months end,
    toddler_verified_at = case when v_final_verdict in ('verified','rejected') then now() else toddler_verified_at end,
    toddler_gate_model = p_model,
    toddler_gate_provenance = coalesce(toddler_gate_provenance, '{}'::jsonb) || jsonb_build_object('toddler_gate', v_evidence)
  where id = p_event_id;

  return v_final_verdict;
end;
$function$;

revoke all on function public.apply_event_toddler_gate(uuid, text, integer, integer, text, text, text, text, text, text) from public;
revoke execute on function public.apply_event_toddler_gate(uuid, text, integer, integer, text, text, text, text, text, text) from anon;
revoke execute on function public.apply_event_toddler_gate(uuid, text, integer, integer, text, text, text, text, text, text) from authenticated;
grant execute on function public.apply_event_toddler_gate(uuid, text, integer, integer, text, text, text, text, text, text) to service_role;

-- One representative row per recurring series (coalesce(program_id, id)
-- as the identity key) so a 10-occurrence recurring event costs one
-- Gemini call, not ten -- there's no existing series-identity grouping
-- in this codebase for LLM-evaluation purposes (verified:
-- candidate_identity_key/normalize_event_key/normalize_dedup_key are all
-- occurrence-level, starts_at-inclusive), so this is new.
create function public.get_events_for_toddler_gate(p_limit integer default 30)
returns table(id uuid, program_id uuid, title text, description text)
language sql
stable
security definer
set search_path to ''
as $function$
  select distinct on (coalesce(e.program_id::text, e.id::text))
    e.id, e.program_id, coalesce(e.display_title, e.title) as title, e.description
  from public.events e
  where e.status = 'published'
    and e.content_status <> 'exclude'
    and e.toddler_verification_status not in ('verified','rejected')
  order by coalesce(e.program_id::text, e.id::text), e.id
  limit greatest(1, least(coalesce(p_limit, 30), 200));
$function$;

revoke all on function public.get_events_for_toddler_gate(integer) from public;
revoke execute on function public.get_events_for_toddler_gate(integer) from anon;
revoke execute on function public.get_events_for_toddler_gate(integer) from authenticated;
grant execute on function public.get_events_for_toddler_gate(integer) to service_role;

-- After gating one representative event, copy its verdict to every
-- other occurrence of the same recurring series (same program_id) --
-- they share the exact same title/description, so the same evidence
-- and verdict genuinely apply; this is propagating one real evaluation,
-- not fabricating N of them.
create function public.propagate_event_toddler_gate_to_series(p_representative_event_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_program_id uuid;
  v_count integer;
begin
  select program_id into v_program_id from public.events where id = p_representative_event_id;
  if v_program_id is null then
    return 0;
  end if;

  update public.events e2
  set toddler_verification_status = src.toddler_verification_status,
      age_min_months = coalesce(e2.age_min_months, src.age_min_months),
      age_max_months = coalesce(e2.age_max_months, src.age_max_months),
      toddler_verified_at = src.toddler_verified_at,
      toddler_gate_model = src.toddler_gate_model,
      toddler_gate_provenance = src.toddler_gate_provenance
  from (select toddler_verification_status, age_min_months, age_max_months, toddler_verified_at, toddler_gate_model, toddler_gate_provenance
        from public.events where id = p_representative_event_id) src
  where e2.program_id = v_program_id and e2.id <> p_representative_event_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.propagate_event_toddler_gate_to_series(uuid) from public;
revoke execute on function public.propagate_event_toddler_gate_to_series(uuid) from anon;
revoke execute on function public.propagate_event_toddler_gate_to_series(uuid) from authenticated;
grant execute on function public.propagate_event_toddler_gate_to_series(uuid) to service_role;
