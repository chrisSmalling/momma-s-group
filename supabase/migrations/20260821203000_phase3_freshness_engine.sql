create table if not exists public.event_freshness_checks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  checked_at timestamptz not null default now(),
  freshness_state text not null check (freshness_state in ('fresh','due','stale','expired','cancelled','completed')),
  source_seen_at timestamptz,
  source_status text,
  reason text,
  next_check_at timestamptz,
  source_signature text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists event_freshness_checks_event_checked_idx on public.event_freshness_checks(event_id,checked_at desc);
create index if not exists event_freshness_checks_next_check_idx on public.event_freshness_checks(next_check_at) where freshness_state in ('due','stale');
create table if not exists public.event_freshness_state (
  event_id uuid primary key references public.events(id) on delete cascade,
  freshness_state text not null default 'fresh' check (freshness_state in ('fresh','due','stale','expired','cancelled','completed')),
  last_checked_at timestamptz,
  last_source_seen_at timestamptz,
  last_source_status text,
  next_check_at timestamptz,
  stale_since timestamptz,
  cancellation_detected_at timestamptz,
  completed_at timestamptz,
  confidence_decay numeric(5,2) not null default 0 check (confidence_decay between 0 and 100),
  reason text,
  source_signature text,
  updated_at timestamptz not null default now()
);
create index if not exists event_freshness_state_due_idx on public.event_freshness_state(next_check_at) where freshness_state in ('due','stale');
create or replace function public.refresh_event_freshness()
returns jsonb language plpgsql security definer set search_path='public','extensions','pg_temp' as $$
declare r record; prev record; sig text; s text; reason text; next_at timestamptz; decay numeric; n integer:=0; due_n integer:=0; stale_n integer:=0; cancelled_n integer:=0; completed_n integer:=0; changed_n integer:=0;
begin
  for r in select e.id,e.starts_at,e.ends_at,e.status,e.content_status,e.created_at,max(a.last_seen_at) source_seen,coalesce(bool_or(a.verification_status='cancelled'),false) source_cancelled,md5(coalesce(string_agg(coalesce(a.external_id,'')||'|'||coalesce(a.raw_payload->>'STATUS','')||'|'||coalesce(a.raw_payload->>'DTSTART','')||'|'||coalesce(a.raw_payload->>'DTEND','')||'|'||coalesce(a.raw_payload->>'SUMMARY',''),'||'),'')) source_signature from events e left join activity_source_records a on a.resolved_event_id=e.id where e.status in ('published','cancelled') group by e.id loop
    select source_signature into prev from event_freshness_state where event_id=r.id; sig:=r.source_signature;
    if r.status='cancelled' then s:='cancelled'; reason:='event_status_cancelled'; next_at:=null; decay:=100; cancelled_n:=cancelled_n+1;
    elsif r.ends_at is not null and r.ends_at < now() then s:='completed'; reason:='event_end_passed'; next_at:=null; decay:=100; completed_n:=completed_n+1;
    elsif r.source_cancelled then s:='cancelled'; reason:='source_record_cancelled'; next_at:=null; decay:=100; cancelled_n:=cancelled_n+1;
    else
      next_at:=case when r.starts_at<=now()+interval '48 hours' then now()+interval '6 hours' when r.starts_at<=now()+interval '7 days' then now()+interval '24 hours' when r.starts_at<=now()+interval '30 days' then now()+interval '3 days' else now()+interval '7 days' end;
      if prev.source_signature is not null and sig is not null and prev.source_signature<>sig then s:='due'; reason:='source_record_changed'; decay:=15; due_n:=due_n+1; changed_n:=changed_n+1;
      elsif r.source_seen is null then s:='due'; reason:='no_source_observation'; decay:=30; due_n:=due_n+1;
      elsif r.source_seen<now()-interval '7 days' then s:='stale'; reason:='source_not_seen_7d'; decay:=60; stale_n:=stale_n+1;
      elsif r.starts_at<=now()+interval '48 hours' and r.source_seen<now()-interval '24 hours' then s:='due'; reason:='near_event_source_verification_due'; decay:=20; due_n:=due_n+1;
      else s:='fresh'; reason:='recent_source_observation'; decay:=0; end if;
      if r.starts_at<now() and r.ends_at is null then s:='completed'; reason:='start_passed_no_end_time'; next_at:=null; decay:=100; completed_n:=completed_n+1; end if;
    end if;
    insert into event_freshness_state(event_id,freshness_state,last_checked_at,last_source_seen_at,last_source_status,next_check_at,stale_since,cancellation_detected_at,completed_at,confidence_decay,reason,source_signature,updated_at) values(r.id,s,now(),r.source_seen,case when r.source_cancelled then 'cancelled' else null end,next_at,case when s='stale' then coalesce((select stale_since from event_freshness_state where event_id=r.id),now()) end,case when s='cancelled' then now() end,case when s='completed' then now() end,decay,reason,sig,now()) on conflict(event_id) do update set freshness_state=excluded.freshness_state,last_checked_at=excluded.last_checked_at,last_source_seen_at=excluded.last_source_seen_at,last_source_status=excluded.last_source_status,next_check_at=excluded.next_check_at,stale_since=case when excluded.freshness_state='stale' then coalesce(event_freshness_state.stale_since,now()) else event_freshness_state.stale_since end,cancellation_detected_at=case when excluded.freshness_state='cancelled' then coalesce(event_freshness_state.cancellation_detected_at,now()) else event_freshness_state.cancellation_detected_at end,completed_at=case when excluded.freshness_state='completed' then coalesce(event_freshness_state.completed_at,now()) else event_freshness_state.completed_at end,confidence_decay=excluded.confidence_decay,reason=excluded.reason,source_signature=excluded.source_signature,updated_at=now();
    insert into event_freshness_checks(event_id,freshness_state,source_seen_at,source_status,reason,next_check_at,source_signature) values(r.id,s,r.source_seen,case when r.source_cancelled then 'cancelled' else null end,reason,next_at,sig);
    if s='cancelled' and r.status='published' then update events set status='cancelled',content_status='exclude',is_kid_relevant=false,content_review_status='auto_approved',content_review_reason='Freshness engine: '||reason,content_verified_at=now() where id=r.id; end if;
    n:=n+1;
  end loop;
  return jsonb_build_object('checked',n,'due',due_n,'stale',stale_n,'cancelled',cancelled_n,'completed',completed_n,'source_changes',changed_n);
end $$;
create or replace function public.get_freshness_queue(limit_count integer default 100)
returns table(event_id uuid,freshness_state text,starts_at timestamptz,next_check_at timestamptz,reason text,confidence_decay numeric) language sql security definer set search_path='public','extensions','pg_temp' as $$ select s.event_id,s.freshness_state,e.starts_at,s.next_check_at,s.reason,s.confidence_decay from event_freshness_state s join events e on e.id=s.event_id where s.freshness_state in ('due','stale') and e.status='published' order by s.next_check_at nulls first,e.starts_at limit greatest(1,least(limit_count,1000)); $$;
revoke all on function public.refresh_event_freshness() from public,anon,authenticated;
revoke all on function public.get_freshness_queue(integer) from public,anon,authenticated;
grant execute on function public.refresh_event_freshness() to service_role;
grant execute on function public.get_freshness_queue(integer) to service_role;
create or replace function public.enforce_event_freshness_publish_guard() returns trigger language plpgsql as $$ begin if new.status='published' and new.content_status='keep' and exists(select 1 from event_freshness_state s where s.event_id=new.id and s.freshness_state in ('stale','cancelled','completed')) then raise exception 'event freshness state prevents keep publishing'; end if; return new; end $$;
drop trigger if exists trg_event_freshness_publish_guard on public.events;
create trigger trg_event_freshness_publish_guard before insert or update on public.events for each row execute function public.enforce_event_freshness_publish_guard();
select cron.schedule('mommas-event-freshness-every-6h','15 */6 * * *',$cmd$select public.refresh_event_freshness();$cmd$) where not exists(select 1 from cron.job where jobname='mommas-event-freshness-every-6h');