-- Prevent recursive RLS evaluation when group_members policies call is_member().
-- SECURITY DEFINER lets the membership helper inspect group_members without
-- re-entering the same authenticated RLS policy.
create or replace function public.is_member(g uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = g
      and user_id = auth.uid()
  );
$$;

grant execute on function public.is_member(uuid) to authenticated;
