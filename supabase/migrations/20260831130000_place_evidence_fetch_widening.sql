-- Enrichment stage, part 1: widen apply_place_toddler_gate to accept
-- optional freshly-fetched evidence text (e.g. the place's own website)
-- so a verdict_quote can be grounded in that text too, not only the
-- stored `description` column. Same substring-match discipline as
-- always (place_evidence_supported), just against a wider evidence
-- corpus when enrichment supplies one. Existing callers (verify-
-- toddler-fit) pass named RPC args and don't set the two new
-- parameters, so their behavior is byte-for-byte unchanged -- this is
-- the same gate widened, not a second one.
--
-- Dropped and recreated rather than a same-signature REPLACE because
-- the parameter list is growing; re-grants service_role-only exactly
-- as 20260830160000 locked it down (a DROP removes ACLs, so this must
-- not be forgotten -- verified by re-checking pg_proc.proacl after
-- applying).
drop function if exists public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text);

create function public.apply_place_toddler_gate(
  p_place_id uuid,
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

  select description into v_description from public.places where id = p_place_id and active = true;
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

  update public.places set
    llm_verification_status = v_final_verdict,
    age_min_months = case
      when p_age_min_months is not null and public.place_evidence_supported(v_evidence_corpus, p_age_quote)
      then coalesce(age_min_months, p_age_min_months) else age_min_months end,
    age_max_months = case
      when p_age_max_months is not null and public.place_evidence_supported(v_evidence_corpus, p_age_quote)
      then coalesce(age_max_months, p_age_max_months) else age_max_months end,
    llm_verified_at = case when v_final_verdict in ('verified','rejected') then now() else llm_verified_at end,
    llm_enriched_at = now(),
    llm_model = p_model,
    llm_enrichment_provenance = coalesce(llm_enrichment_provenance, '{}'::jsonb) || jsonb_build_object('toddler_gate', v_evidence),
    llm_last_revalidation = coalesce(llm_last_revalidation, '{}'::jsonb) || jsonb_build_object('toddler_gate_verdict', v_final_verdict, 'toddler_gate_checked_at', now())
  where id = p_place_id and active = true;

  return v_final_verdict;
end;
$function$;

-- revoke all ... from public only strips the implicit PUBLIC grant, not
-- the separate explicit anon/authenticated entries Supabase's default
-- privileges add to every newly CREATEd function -- caught live via
-- pg_proc.proacl (this migration's first apply left anon/authenticated
-- executable, the same bug class fixed for ~22 other functions in
-- 20260829180000 and again for the toddler-gate functions in
-- 20260830160000). All three revokes are required.
revoke all on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text, text, text) from public;
revoke execute on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text, text, text) from anon;
revoke execute on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text, text, text) from authenticated;
grant execute on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text, text, text) to service_role;
