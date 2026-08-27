-- Phase 1.1 (Poppy v2 handoff): the propose-meetup RLS failure traces to
-- groups whose creator has no group_members row. createGroup() does the
-- group insert and the membership insert as two separate, non-transactional
-- writes; group_members' INSERT policy is `with_check: false` (join only
-- through a trusted function), so that second write has always been
-- rejected by RLS for brand-new groups. This didn't surface as a visible
-- error before because [see accompanying app-code fix in groups/actions.ts]
-- — but the missing row silently broke is_member()-gated features
-- (propose a meetup, the /plans roster, RSVP sharing) for that group.
--
-- Repair any existing orphans (idempotent; none found in production as of
-- this migration, since all current groups predate the trusted-function
-- restriction, but safe to run regardless / on any future environment).
insert into public.group_members (group_id, user_id)
select g.id, g.created_by from public.groups g
where g.created_by is not null
  and not exists (select 1 from public.group_members m
                  where m.group_id = g.id and m.user_id = g.created_by)
on conflict do nothing;

-- Prevent recurrence: creator is always a member, regardless of path.
-- SECURITY DEFINER is scoped tightly — it only ever inserts the group's own
-- creator into group_members, nothing else, and doesn't touch any other
-- table's RLS.
create or replace function public.add_creator_as_member()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.created_by is not null then
    insert into public.group_members (group_id, user_id)
    values (new.id, new.created_by) on conflict do nothing;
  end if;
  return new;
end; $$;
revoke all on function public.add_creator_as_member() from public, anon;

drop trigger if exists groups_add_creator_member on public.groups;
create trigger groups_add_creator_member
  after insert on public.groups for each row
  execute function public.add_creator_as_member();
