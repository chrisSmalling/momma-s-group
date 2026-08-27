-- Keep event proposal authorization aligned with the groups UI.
-- Group creators are valid proposal authors even if membership has not yet
-- been materialized; ordinary users still must be members of the target group.
drop policy if exists "add events" on public.events;
create policy "add events" on public.events
for insert to authenticated
with check (
  added_by = (select auth.uid())
  and proposed_by_group is not null
  and (
    public.is_member(proposed_by_group)
    or exists (
      select 1
      from public.groups g
      where g.id = proposed_by_group
        and g.created_by = (select auth.uid())
    )
  )
);
