update public.events
set content_status='review',
    content_review_reason='Safety invariant repair: keep requires kid-relevant=true',
    content_verified_at=now()
where status='published'
  and content_status='keep'
  and is_kid_relevant=false;

alter table public.events
  drop constraint if exists events_keep_requires_kid_relevant;

alter table public.events
  add constraint events_keep_requires_kid_relevant
  check (content_status <> 'keep' or is_kid_relevant = true);
