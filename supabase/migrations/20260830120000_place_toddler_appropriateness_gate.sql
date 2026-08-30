-- Toddler-appropriateness gate for places.
--
-- The real bug this fixes, verified live 2026-08-30: `llm_verification_status`
-- already drives eligibility everywhere (the "read places" RLS policy, which
-- search_places relies on entirely, and poppy_recommendation_candidates both
-- require it = 'verified') -- but `classify-places`' writePlace() sets
-- 'verified' the moment ANY facility-amenity claim (changing table, stroller
-- access, etc.) is accepted. That establishes "we know a fact about this
-- place," not "this place is confirmed appropriate for a toddler." Only 8/102
-- active places are 'verified' today, and none of those 8 went through any
-- age-suitability check -- the facility-amenity gate and the toddler-fit gate
-- were never actually separated.
--
-- (One claim from the handoff that prompted this did NOT reproduce under
-- rigorous testing: `search_places`, tested as a genuinely simulated
-- `authenticated` session -- real `auth.role()`/`auth.uid()` JWT context, not
-- the superuser connection this MCP tool otherwise uses, which bypasses RLS
-- entirely -- returns only the 8 verified places, zero unverified ones. RLS
-- already protects it correctly. The real, verified problem is narrower:
-- what 'verified' currently *means* doesn't establish toddler-appropriateness
-- at all, so Poppy and search are both structurally starved to a set that
-- was never actually vetted for toddler use.)
--
-- Fix: separate the two concerns explicitly.
--   1. Facility-amenity extraction (classify-places, existing, unchanged
--      logic) keeps writing has_changing_table/nursing_friendly/etc, but no
--      longer touches llm_verification_status at all (see the accompanying
--      edge function change).
--   2. A new, dedicated toddler-appropriateness gate -- deterministic
--      hard-reject rules first (free, instant, no LLM needed for obvious
--      cases), then LLM judgment for the ambiguous middle, evidence-quote
--      gated the same way classify-places already proves facts (never trust
--      a claim without a literal supporting quote from the place's own
--      description) -- is the ONLY thing that sets llm_verification_status
--      going forward. Since both search_places (via RLS) and
--      poppy_recommendation_candidates already gate on this exact column,
--      fixing what it means fixes both surfaces at once -- no separate
--      "make search and Poppy agree" step needed, they already share this
--      one column structurally.
--
-- Also captures, verbatim from the live database (via pg_get_functiondef,
-- not hand-reconstructed), the bodies of several functions this migration
-- builds on that had never been captured before (apply_place_enrichment,
-- apply_place_enrichment_v2, get_places_for_enrichment,
-- get_places_for_revalidation, recompute_place_evidence_status,
-- revalidate_places_with_evidence, place_evidence_supported,
-- normalize_for_evidence) -- the same class of unversioned drift
-- db/README.md already documents and has been caught once before
-- (20260829180000_reconcile_function_privileges.sql, privileges only; this
-- time it's full function bodies). None of their logic changes here.

-- ============================================================
-- Capture pre-existing, previously-unversioned functions verbatim
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_for_evidence(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select btrim(
    regexp_replace(
      lower(
        translate(
          coalesce(t,''),
          -- curly single/double quotes, en/em dash, nbsp -> ascii equivalents
          '‘’“”–— ',
          '''''""--' || ' '
        )
      ),
      '\s+', ' ', 'g'
    )
  );
$function$;

-- FIX (not a verbatim capture): the live version of this function calls
-- normalize_for_evidence(...) unqualified while itself running under
-- `SET search_path TO ''` -- which means the unqualified call can never
-- resolve (public isn't searched with an empty path). Confirmed live: this
-- function currently throws `function normalize_for_evidence(text) does
-- not exist` on every call. It's never been caught because none of its
-- only callers (apply_place_enrichment_v2, recompute_place_evidence_status,
-- revalidate_places_with_evidence) are invoked by anything live either --
-- the same "committed/deployed but never actually exercised" pattern this
-- whole audit keeps finding. Schema-qualifying the call is the fix; this
-- function is central to the new toddler gate below, so it has to actually
-- work now.
CREATE OR REPLACE FUNCTION public.place_evidence_supported(p_description text, p_evidence text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    -- Require real evidence: at least 8 normalized chars, else reject.
    when length(public.normalize_for_evidence(p_evidence)) < 8 then false
    else position(
      public.normalize_for_evidence(p_evidence) in public.normalize_for_evidence(p_description)
    ) > 0
  end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_place_enrichment(p_place_id uuid, p_has_changing_table boolean, p_nursing_friendly boolean, p_stroller_accessible boolean, p_quiet_or_sensory_friendly boolean, p_what_to_bring text[], p_price_note text, p_parking_notes text, p_model text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.places
  set has_changing_table        = coalesce(has_changing_table, p_has_changing_table),
      nursing_friendly          = coalesce(nursing_friendly, p_nursing_friendly),
      stroller_accessible       = coalesce(stroller_accessible, p_stroller_accessible),
      quiet_or_sensory_friendly = coalesce(quiet_or_sensory_friendly, p_quiet_or_sensory_friendly),
      what_to_bring = case
        when (what_to_bring is null or cardinality(what_to_bring) = 0)
             and p_what_to_bring is not null and cardinality(p_what_to_bring) > 0
        then p_what_to_bring else what_to_bring end,
      price_note = case
        when coalesce(btrim(price_note),'') = '' and nullif(btrim(p_price_note),'') is not null
        then p_price_note else price_note end,
      parking_notes = case
        when coalesce(btrim(parking_notes),'') = '' and nullif(btrim(p_parking_notes),'') is not null
        then p_parking_notes else parking_notes end,
      llm_enriched_at = now(),
      llm_model = p_model
  where id = p_place_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_place_enrichment_v2(p_place_id uuid, p_claims jsonb, p_model text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare src text; ev jsonb; accepted jsonb:='{}'::jsonb; rejected text[]:='{}'; k text; v_price text; v_parking text; v_has boolean; v_nurse boolean; v_stroller boolean; v_quiet boolean; accepted_count integer; rejected_count integer; begin select description into src from public.places where id=p_place_id and active=true for update; if src is null then return jsonb_build_object('ok',false,'reason','place_not_found'); end if; ev:=coalesce(p_claims->'evidence','{}'::jsonb); if jsonb_typeof(p_claims->'has_changing_table')='boolean' and public.place_evidence_supported(src,ev->>'has_changing_table') then v_has:=(p_claims->>'has_changing_table')::boolean; accepted:=accepted||jsonb_build_object('has_changing_table',ev->>'has_changing_table'); end if; if jsonb_typeof(p_claims->'nursing_friendly')='boolean' and public.place_evidence_supported(src,ev->>'nursing_friendly') then v_nurse:=(p_claims->>'nursing_friendly')::boolean; accepted:=accepted||jsonb_build_object('nursing_friendly',ev->>'nursing_friendly'); end if; if jsonb_typeof(p_claims->'stroller_accessible')='boolean' and public.place_evidence_supported(src,ev->>'stroller_accessible') then v_stroller:=(p_claims->>'stroller_accessible')::boolean; accepted:=accepted||jsonb_build_object('stroller_accessible',ev->>'stroller_accessible'); end if; if jsonb_typeof(p_claims->'quiet_or_sensory_friendly')='boolean' and public.place_evidence_supported(src,ev->>'quiet_or_sensory_friendly') then v_quiet:=(p_claims->>'quiet_or_sensory_friendly')::boolean; accepted:=accepted||jsonb_build_object('quiet_or_sensory_friendly',ev->>'quiet_or_sensory_friendly'); end if; if jsonb_typeof(p_claims->'what_to_bring')='array' and jsonb_array_length(p_claims->'what_to_bring')>0 and public.place_evidence_supported(src,ev->>'what_to_bring') then accepted:=accepted||jsonb_build_object('what_to_bring',p_claims->'what_to_bring'); end if; if nullif(btrim(p_claims->>'price_note'),'') is not null and public.place_evidence_supported(src,ev->>'price_note') then v_price:=left(btrim(p_claims->>'price_note'),300); accepted:=accepted||jsonb_build_object('price_note',ev->>'price_note'); end if; if nullif(btrim(p_claims->>'parking_notes'),'') is not null and public.place_evidence_supported(src,ev->>'parking_notes') then v_parking:=left(btrim(p_claims->>'parking_notes'),300); accepted:=accepted||jsonb_build_object('parking_notes',ev->>'parking_notes'); end if; for k in select jsonb_object_keys(p_claims) loop if k in ('has_changing_table','nursing_friendly','stroller_accessible','quiet_or_sensory_friendly','what_to_bring','price_note','parking_notes') and p_claims->k is not null and (ev->>k is null or not public.place_evidence_supported(src,ev->>k)) then rejected:=array_append(rejected,k); end if; end loop; select count(*) into accepted_count from jsonb_object_keys(accepted); rejected_count:=coalesce(array_length(rejected,1),0); update public.places set has_changing_table=coalesce(has_changing_table,v_has),nursing_friendly=coalesce(nursing_friendly,v_nurse),stroller_accessible=coalesce(stroller_accessible,v_stroller),quiet_or_sensory_friendly=coalesce(quiet_or_sensory_friendly,v_quiet),price_note=case when coalesce(btrim(price_note),'')='' and v_price is not null then v_price else price_note end,parking_notes=case when coalesce(btrim(parking_notes),'')='' and v_parking is not null then v_parking else parking_notes end,llm_enrichment_evidence=coalesce(llm_enrichment_evidence,'{}'::jsonb)||accepted,llm_enrichment_provenance=coalesce(llm_enrichment_provenance,'{}'::jsonb)||jsonb_build_object('verified_ai',accepted),llm_enriched_at=case when accepted_count>0 then now() else llm_enriched_at end,llm_model=case when accepted_count>0 then p_model else llm_model end,llm_verification_status=case when accepted_count>0 and rejected_count=0 then 'verified' when rejected_count>0 then 'needs_review' else 'unverified' end,llm_verified_at=case when accepted_count>0 and rejected_count=0 then now() else null end,llm_last_revalidation=jsonb_build_object('accepted',accepted,'rejected',to_jsonb(rejected),'verified',accepted_count>0 and rejected_count=0) where id=p_place_id; return jsonb_build_object('ok',true,'accepted',accepted,'rejected',to_jsonb(rejected),'verified',accepted_count>0 and rejected_count=0); end; $function$;

CREATE OR REPLACE FUNCTION public.get_places_for_enrichment(p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, name text, description text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.name, p.description
  from public.places p
  where p.active = true
    and p.llm_enriched_at is null
    and p.description is not null
    and length(btrim(p.description)) >= 40
  order by p.id
  limit greatest(1, least(coalesce(p_limit, 25), 200));
$function$;

CREATE OR REPLACE FUNCTION public.get_places_for_revalidation(p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, name text, description text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select p.id,p.name,p.description from public.places p where p.active=true and (p.llm_verification_status is distinct from 'verified' or coalesce(p.facility_data_source,'unknown')='legacy_unknown') and coalesce(p.description,'')<>'' order by p.llm_enriched_at nulls first,p.name limit greatest(1,least(coalesce(p_limit,10),50)); $function$;

CREATE OR REPLACE FUNCTION public.recompute_place_evidence_status(p_place_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare src text; ev jsonb; keys text[]; k text; ok_count int:=0; bad_count int:=0; accepted jsonb:='{}'; rejected jsonb:='[]'; begin select description,llm_enrichment_evidence into src,ev from public.places where id=p_place_id and active=true; if src is null then return jsonb_build_object('ok',false,'reason','place_not_found'); end if; ev:=coalesce(ev,'{}'::jsonb); keys:=array(select jsonb_object_keys(ev)); foreach k in array keys loop if public.place_evidence_supported(src,ev->>k) then ok_count:=ok_count+1; accepted:=accepted||jsonb_build_object(k,ev->>k); else bad_count:=bad_count+1; rejected:=rejected||jsonb_build_array(k); end if; end loop; update public.places set llm_verification_status=case when ok_count>0 and bad_count=0 then 'verified' when bad_count>0 then 'needs_review' else 'unverified' end,llm_verified_at=case when ok_count>0 and bad_count=0 then coalesce(llm_verified_at,now()) else null end,llm_last_revalidation=jsonb_build_object('accepted',accepted,'rejected',rejected,'verified',ok_count>0 and bad_count=0,'recomputed_at',now()) where id=p_place_id; return jsonb_build_object('ok',true,'accepted_count',ok_count,'rejected_count',bad_count,'verified',ok_count>0 and bad_count=0); end; $function$;

CREATE OR REPLACE FUNCTION public.revalidate_places_with_evidence(p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare r record; n int:=0; v int:=0; rv jsonb; begin for r in select id from public.places where active=true and llm_enrichment_evidence is not null order by llm_enriched_at nulls last limit greatest(1,least(coalesce(p_limit,100),500)) loop rv:=public.recompute_place_evidence_status(r.id); n:=n+1; if coalesce((rv->>'verified')::boolean,false) then v:=v+1; end if; end loop; return jsonb_build_object('processed',n,'verified',v); end; $function$;

grant execute on function public.normalize_for_evidence(text) to service_role;
grant execute on function public.place_evidence_supported(text, text) to authenticated, service_role;
grant execute on function public.apply_place_enrichment(uuid, boolean, boolean, boolean, boolean, text[], text, text, text) to service_role;
grant execute on function public.apply_place_enrichment_v2(uuid, jsonb, text) to service_role;
grant execute on function public.get_places_for_enrichment(integer) to service_role;
grant execute on function public.get_places_for_revalidation(integer) to service_role;
grant execute on function public.recompute_place_evidence_status(uuid) to service_role;
grant execute on function public.revalidate_places_with_evidence(integer) to service_role;

-- ============================================================
-- New: 'rejected' state
-- ============================================================

alter table public.places drop constraint places_llm_verification_status_check;
alter table public.places add constraint places_llm_verification_status_check
  check (llm_verification_status = any (array['unverified','verified','needs_review','rejected']));

-- ============================================================
-- New: deterministic hard-reject rules (free, instant, no LLM needed)
-- ============================================================

create or replace function public.place_hard_reject_reason(p_name text, p_description text, p_category_tags text[])
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when p_name ~* '\y(brewery|brewing( co)?|brew ?pub|winery|wine bar|distillery|taproom|nightclub|night club|casino|strip club|adult entertainment|cigar lounge|vape shop|smoke shop|hookah)\y'
      then 'venue name indicates an adult-oriented business type'
    when p_description ~* '\y(21\+|18\+|21 and (up|older)|18 and (up|older)|must be (18|21)|adults[- ]only|no children|no minors|no kids allowed|age[- ]restricted)\y'
      then 'description states an age restriction incompatible with toddlers'
    else null
  end;
$$;

grant execute on function public.place_hard_reject_reason(text, text, text[]) to authenticated, service_role;

-- ============================================================
-- New: selector for the toddler-appropriateness gate
-- Targets anything not yet at a terminal state (verified/rejected) -- so
-- 'unverified' (never checked) and 'needs_review' (checked, ambiguous --
-- eligible for re-check, e.g. after a description update) both queue up.
-- ============================================================

create or replace function public.get_places_for_toddler_gate(p_limit integer default 50)
returns table(id uuid, name text, description text, category_tags text[], place_type text)
language sql
stable
set search_path to ''
as $$
  select p.id, p.name, p.description, p.category_tags, p.place_type
  from public.places p
  where p.active = true
    and p.llm_verification_status not in ('verified','rejected')
    and coalesce(p.description,'') <> ''
  order by p.llm_enriched_at nulls first, p.name
  limit greatest(1, least(coalesce(p_limit,50), 200));
$$;

grant execute on function public.get_places_for_toddler_gate(integer) to service_role;

-- ============================================================
-- New: apply a toddler-appropriateness verdict. The ONLY function allowed
-- to set llm_verification_status going forward -- classify-places no
-- longer touches it (see the accompanying edge function change).
--
-- A 'verified' or 'rejected' verdict is only ever recorded if it comes
-- with a real supporting quote from the place's own description; a claimed
-- verdict without evidence downgrades to 'needs_review' rather than being
-- trusted. Same for the age range: only recorded when the LLM's age quote
-- is real evidence, and even then only fills gaps -- never overwrites an
-- existing, real age_min_months/age_max_months.
-- ============================================================

create or replace function public.apply_place_toddler_gate(
  p_place_id uuid,
  p_verdict text,
  p_age_min_months integer,
  p_age_max_months integer,
  p_verdict_quote text,
  p_age_quote text,
  p_reasoning text,
  p_model text
)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_description text;
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

  if p_verdict in ('verified','rejected')
     and not public.place_evidence_supported(v_description, p_verdict_quote) then
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
    'checked_at', now()
  );

  update public.places set
    llm_verification_status = v_final_verdict,
    age_min_months = case
      when p_age_min_months is not null and public.place_evidence_supported(v_description, p_age_quote)
      then coalesce(age_min_months, p_age_min_months) else age_min_months end,
    age_max_months = case
      when p_age_max_months is not null and public.place_evidence_supported(v_description, p_age_quote)
      then coalesce(age_max_months, p_age_max_months) else age_max_months end,
    llm_verified_at = case when v_final_verdict in ('verified','rejected') then now() else llm_verified_at end,
    llm_enriched_at = now(),
    llm_model = p_model,
    llm_enrichment_provenance = coalesce(llm_enrichment_provenance, '{}'::jsonb) || jsonb_build_object('toddler_gate', v_evidence),
    llm_last_revalidation = coalesce(llm_last_revalidation, '{}'::jsonb) || jsonb_build_object('toddler_gate_verdict', v_final_verdict, 'toddler_gate_checked_at', now())
  where id = p_place_id and active = true;

  return v_final_verdict;
end;
$$;

grant execute on function public.apply_place_toddler_gate(uuid, text, integer, integer, text, text, text, text) to service_role;

-- ============================================================
-- Run the hard-reject rules against everything not already verified, right
-- now -- free, deterministic, no LLM call needed for these obvious cases.
-- Anything this doesn't catch queues up for the LLM pass via
-- get_places_for_toddler_gate() (run by the new verify-toddler-fit edge
-- function).
-- ============================================================

update public.places p
set llm_verification_status = 'rejected',
    llm_verified_at = now(),
    llm_enriched_at = now(),
    llm_model = 'hard-rule-v1',
    llm_enrichment_provenance = coalesce(llm_enrichment_provenance, '{}'::jsonb) || jsonb_build_object(
      'toddler_gate', jsonb_build_object(
        'verdict', 'rejected',
        'reasoning', public.place_hard_reject_reason(p.name, p.description, p.category_tags),
        'model', 'hard-rule-v1',
        'checked_at', now()
      )
    )
where p.active = true
  and p.llm_verification_status <> 'verified'
  and public.place_hard_reject_reason(p.name, p.description, p.category_tags) is not null;
