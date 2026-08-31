-- Enrichment stage, part 2: selector for places worth fetching more
-- evidence for. Scoped to exactly the actionable subset -- a real
-- fetchable business page, not the OSM node's own metadata page
-- (openstreetmap.org is a listing about the place, not the place's own
-- content, so it's not useful evidence to fetch).
--
-- Ordered by when evidence was last attempted (nulls first): a page
-- that failed to fetch today might work next week, so failed attempts
-- cycle to the back of the queue rather than being permanently
-- skipped, without hammering the same dead URL every single run.
create function public.get_places_for_evidence_enrichment(p_limit integer default 25)
returns table(id uuid, name text, description text, website text, source_url text)
language sql
stable
security definer
set search_path to ''
as $function$
  select p.id, p.name, p.description, p.website, p.source_url
  from public.places p
  where p.active = true
    and p.llm_verification_status in ('needs_review', 'unverified')
    and (
      (p.website is not null and btrim(p.website) <> '')
      or (p.source_url is not null and p.source_url not like '%openstreetmap.org%')
    )
  order by (p.llm_enrichment_provenance->>'evidence_fetch_attempted_at')::timestamptz nulls first, p.id
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$function$;

revoke all on function public.get_places_for_evidence_enrichment(integer) from public;
revoke execute on function public.get_places_for_evidence_enrichment(integer) from anon;
revoke execute on function public.get_places_for_evidence_enrichment(integer) from authenticated;
grant execute on function public.get_places_for_evidence_enrichment(integer) to service_role;

-- Records that a fetch was attempted (success or failure) so the
-- selector above can cycle the queue fairly without a full gate call --
-- called even when the fetch itself failed (no verdict to apply yet).
create function public.mark_place_evidence_fetch_attempted(p_place_id uuid, p_source_url text, p_fetch_ok boolean)
returns void
language sql
security definer
set search_path to ''
as $function$
  update public.places
  set llm_enrichment_provenance = coalesce(llm_enrichment_provenance, '{}'::jsonb) || jsonb_build_object(
    'evidence_fetch_attempted_at', now(),
    'evidence_fetch_source_url', p_source_url,
    'evidence_fetch_ok', p_fetch_ok
  )
  where id = p_place_id and active = true;
$function$;

revoke all on function public.mark_place_evidence_fetch_attempted(uuid, text, boolean) from public;
revoke execute on function public.mark_place_evidence_fetch_attempted(uuid, text, boolean) from anon;
revoke execute on function public.mark_place_evidence_fetch_attempted(uuid, text, boolean) from authenticated;
grant execute on function public.mark_place_evidence_fetch_attempted(uuid, text, boolean) to service_role;
