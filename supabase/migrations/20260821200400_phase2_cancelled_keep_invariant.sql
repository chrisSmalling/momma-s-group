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
