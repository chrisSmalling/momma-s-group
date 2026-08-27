-- Phase 1.2 (Poppy v2 handoff): group_members has no UPDATE policy anywhere
-- in schema or migrations, confirmed via pg_policies. updateThingsToKnow()
-- (groups/actions.ts) does an .update() that RLS silently turns into a
-- 0-row no-op - no error, so the action redirects as success even though
-- nothing was written. This policy lets a member update only their own row.
create policy "update own membership" on public.group_members for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
