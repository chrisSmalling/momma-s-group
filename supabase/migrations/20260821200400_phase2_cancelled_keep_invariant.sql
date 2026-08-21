-- Phase 2 corrective migration: cancelled events must never remain feed-eligible.
update public.events
set content_status='exclude',
    is_kid_relevant=false,
    content_review_status='auto_approved',
    content_review_reason=coalesce(content_review_reason,'Cancelled events cannot remain feed-eligible')
where status='cancelled' and content_status='keep';

alter table public.events drop constraint if exists events_keep_requires_published;
alter table public.events
  add constraint events_keep_requires_published
  check (content_status <> 'keep' or status = 'published');

-- Keep source-quality feedback honest: cancellations are not automatically
-- classified as bad content; only explicit duplicate lineage counts as a
-- duplicate-quality outcome.
create or replace function public.refresh_phase2_quality_feedback()
returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $function$
declare
  s record;
  updated_sources integer := 0;
  updated_candidates integer := 0;
begin
  for s in
    select cs.id,
      coalesce(cs.source_priority,50)::numeric as prior,
      count(e.id) filter(where e.status='published' and e.content_status='keep') as good_count,
      count(e.id) filter(where e.status='published' and e.content_status='exclude') as bad_count,
      count(e.id) filter(where e.duplicate_of_event_id is not null) as duplicate_count
    from public.content_sources cs
    left join public.events e
      on e.source_id=cs.id and e.created_at>=now()-interval '90 days'
    where cs.active is distinct from false
    group by cs.id
  loop
    insert into public.event_source_trust(
      source_id,prior_score,observed_events,observed_good,observed_bad,
      observed_duplicate,trust_score,sample_confidence,auto_publish_eligible,updated_at
    )
    values(
      s.id,
      greatest(0,least(100,s.prior)),
      s.good_count+s.bad_count+s.duplicate_count,
      s.good_count,s.bad_count,s.duplicate_count,
      greatest(0,least(100,round(
        (s.prior*(20.0/(20+s.good_count+s.bad_count+s.duplicate_count))) +
        (100.0*s.good_count/greatest(1,s.good_count+s.bad_count+s.duplicate_count)) *
        ((s.good_count+s.bad_count+s.duplicate_count)::numeric/(20+s.good_count+s.bad_count+s.duplicate_count)),1
      ))),
      least(1,(s.good_count+s.bad_count+s.duplicate_count)::numeric/20),
      (s.good_count+s.bad_count+s.duplicate_count)>=20
        and (100.0*s.good_count/greatest(1,s.good_count+s.bad_count+s.duplicate_count))>=95
        and s.duplicate_count=0,
      now()
    )
    on conflict(source_id) do update set
      prior_score=excluded.prior_score,
      observed_events=excluded.observed_events,
      observed_good=excluded.observed_good,
      observed_bad=excluded.observed_bad,
      observed_duplicate=excluded.observed_duplicate,
      trust_score=excluded.trust_score,
      sample_confidence=excluded.sample_confidence,
      auto_publish_eligible=excluded.auto_publish_eligible,
      updated_at=now();
    update public.content_sources cs
    set reliability_score=round(t.trust_score)::integer,
        last_quality_update_at=now(),
        successful_event_count=t.observed_good,
        rejected_event_count=t.observed_bad,
        discovery_count=t.observed_events
    from public.event_source_trust t
    where cs.id=t.source_id and cs.id=s.id;
    updated_sources := updated_sources+1;
  end loop;

  -- Reuse the canonical candidate-quality evaluator already installed by
  -- Phase 2; this call refreshes source trust and candidate decisions daily.
  insert into public.event_candidate_quality(candidate_id,evaluated_at)
  select id,now()
  from public.event_discovery_candidates
  where candidate_status in ('discovered','deferred','enriching','promoted','duplicate','rejected','error')
  on conflict(candidate_id) do update set evaluated_at=excluded.evaluated_at;
  get diagnostics updated_candidates=row_count;

  return jsonb_build_object(
    'sources_updated',updated_sources,
    'candidates_evaluated',updated_candidates,
    'evaluated_at',now()
  );
end;
$function$;
