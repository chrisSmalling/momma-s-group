-- Fix: get_places_for_toddler_gate excluded places with an empty/null
-- description (coalesce(description,'') <> ''), so places with no
-- description at all (confirmed live 2026-08-30: 24 places -- mostly
-- library branches, parks, a museum -- that have amenity data but never
-- got a text description) could NEVER enter the toddler-gate queue and
-- would stay 'unverified' forever. That silently violates this feature's
-- own acceptance bar ("all places move to verified/needs_review/rejected,
-- none left unverified").
--
-- Safe to simply widen the selector: apply_place_toddler_gate already
-- requires a verdict_quote that place_evidence_supported() can match as a
-- literal substring of the description before it will accept a
-- 'verified'/'rejected' verdict -- an empty description makes that
-- impossible by construction, so the existing evidence gate would force
-- these to needs_review even without any further change. This migration
-- also adds a direct, free, deterministic path for them (see
-- verify-toddler-fit) rather than spending an LLM call on a call whose
-- outcome is already fixed by the evidence rule.
create or replace function public.get_places_for_toddler_gate(p_limit integer default 50)
returns table(id uuid, name text, description text, category_tags text[], place_type text)
language sql
stable
set search_path to ''
as $function$
  select p.id, p.name, p.description, p.category_tags, p.place_type
  from public.places p
  where p.active = true
    and p.llm_verification_status not in ('verified','rejected')
  order by p.llm_enriched_at nulls first, p.name
  limit greatest(1, least(coalesce(p_limit,50), 200));
$function$;
