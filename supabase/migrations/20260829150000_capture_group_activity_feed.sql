-- Capture schema drift: group_activity_feed view
--
-- Exists in the live database but NOT in the repo migrations (verified
-- 2026-08-29). It backs the CalendarSocialSignals "friends going" strip, which
-- renders on the calendar page — so without this, a fresh environment (preview
-- branch, local, re-provision) would be missing the view and that component
-- would error against a non-existent relation.
--
-- Reproduced exactly from the live definition. `create or replace view` is
-- idempotent: a no-op against production, a full create on a fresh env.
--
-- ⚠️  security_invoker = true is LOAD-BEARING. It makes the view run under the
-- querying user's privileges so the `events` RLS ("authenticated AND
-- (proposed_by_group IS NULL OR is_member(proposed_by_group))") restricts rows
-- to the viewer's own groups. Without it, the view runs as owner and leaks
-- every group's proposed meetups to every user. Do not drop this option.

create or replace view public.group_activity_feed
with (security_invoker = true) as
select
  e.id                as event_id,
  e.proposed_by_group as group_id,
  e.added_by          as proposer_id,
  e.title,
  e.venue_name,
  e.starts_at,
  (
    select count(*)
    from public.rsvps r
    where r.event_id = e.id and r.status = 'going'
  )::integer as going_count,
  (
    exists (
      select 1
      from public.rsvps r
      where r.event_id = e.id and r.status = 'going' and r.user_id = auth.uid()
    )
  ) as viewer_is_going
from public.events e
where e.proposed_by_group is not null
  and e.status = 'published'
  and coalesce(e.is_suppressed, false) = false;
