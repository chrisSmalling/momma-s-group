-- shares_group_with is called from authenticated requests/RLS checks.
-- Keep the function SECURITY DEFINER so it can safely inspect group_members,
-- while explicitly allowing logged-in users to execute it.
grant execute on function public.shares_group_with(uuid) to authenticated;
