revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated, service_role;
