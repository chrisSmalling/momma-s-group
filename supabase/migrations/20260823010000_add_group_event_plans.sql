create table if not exists public.group_event_plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  question text not null default 'Anyone want to do this?',
  status text not null default 'open' check (status in ('open','planned','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists group_event_plans_one_open on public.group_event_plans(group_id,event_id) where status='open';
create index if not exists group_event_plans_group_idx on public.group_event_plans(group_id,created_at desc);
create index if not exists group_event_plans_event_idx on public.group_event_plans(event_id);

alter table public.group_event_plans enable row level security;

create policy group_event_plans_select_members on public.group_event_plans for select to authenticated using (exists (select 1 from public.group_members gm where gm.group_id=group_event_plans.group_id and gm.user_id=auth.uid()));
create policy group_event_plans_insert_members on public.group_event_plans for insert to authenticated with check (created_by=auth.uid() and exists (select 1 from public.group_members gm where gm.group_id=group_event_plans.group_id and gm.user_id=auth.uid()));
create policy group_event_plans_update_creator on public.group_event_plans for update to authenticated using (created_by=auth.uid()) with check (created_by=auth.uid());

create or replace function public.ask_group_about_event(p_group_id uuid,p_event_id uuid,p_question text default 'Anyone want to do this?')
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare plan_id uuid;
begin
  if not exists(select 1 from public.group_members where group_id=p_group_id and user_id=auth.uid()) then raise exception 'not a group member'; end if;
  if not exists(select 1 from public.feed_events where id=p_event_id) then raise exception 'event not available'; end if;
  insert into public.group_event_plans(group_id,event_id,created_by,question)
  values(p_group_id,p_event_id,auth.uid(),coalesce(nullif(trim(p_question),''),'Anyone want to do this?'))
  on conflict do nothing returning id into plan_id;
  if plan_id is null then select id into plan_id from public.group_event_plans where group_id=p_group_id and event_id=p_event_id and status='open' limit 1; end if;
  return plan_id;
end;
$$;

revoke all on function public.ask_group_about_event(uuid,uuid,text) from public;
revoke all on function public.ask_group_about_event(uuid,uuid,text) from anon;
grant execute on function public.ask_group_about_event(uuid,uuid,text) to authenticated;
