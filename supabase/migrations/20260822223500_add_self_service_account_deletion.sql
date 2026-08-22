alter table public.groups drop constraint if exists groups_created_by_fkey;
alter table public.groups add constraint groups_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.events drop constraint if exists events_added_by_fkey;
alter table public.events add constraint events_added_by_fkey foreign key (added_by) references auth.users(id) on delete set null;

create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  delete from public.groups g
  where g.created_by = uid
    and not exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id <> uid
    );

  delete from auth.users where id = uid;
  return true;
end;
$function$;

revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.delete_my_account() to service_role;
