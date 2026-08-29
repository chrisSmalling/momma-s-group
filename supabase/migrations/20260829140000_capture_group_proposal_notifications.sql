-- Capture schema drift: group_proposal_notifications + propose_event_for_group
--
-- These objects exist in the live database but are NOT in the repo migrations
-- (verified 2026-08-29 against the live project). This migration captures them
-- EXACTLY so Git is the source of truth again and fresh environments (preview
-- branches, local, re-provisions) recreate them. It is idempotent: a safe no-op
-- against the existing production DB, a full create on a fresh one.
--
-- Nothing here changes production behavior — it records reality.

begin;

-- ── Table ────────────────────────────────────────────────────────────────
create table if not exists public.group_proposal_notifications (
  id           uuid        primary key default gen_random_uuid(),
  event_id     uuid        not null references public.events(id) on delete cascade,
  group_id     uuid        not null references public.groups(id) on delete cascade,
  recipient_id uuid        not null references auth.users(id)    on delete cascade,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  unique (event_id, recipient_id)
);

create index if not exists group_proposal_notifications_group_id_idx
  on public.group_proposal_notifications (group_id);
create index if not exists group_proposal_notifications_recipient_id_idx
  on public.group_proposal_notifications (recipient_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.group_proposal_notifications enable row level security;

drop policy if exists "members can read their proposal notifications"
  on public.group_proposal_notifications;
create policy "members can read their proposal notifications"
  on public.group_proposal_notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists "members can mark their proposal notifications read"
  on public.group_proposal_notifications;
create policy "members can mark their proposal notifications read"
  on public.group_proposal_notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
-- No INSERT policy by design: rows are written only by the SECURITY DEFINER
-- function below, never by clients directly.

-- ── Writer (SECURITY DEFINER RPC) ────────────────────────────────────────
-- Reproduced exactly from the live definition. Creates the proposed event,
-- auto-RSVPs the proposer as 'going', and fans out a notification to every
-- OTHER member of the group. Authorizes on created_by OR membership, which is
-- why calling this (instead of a direct events insert) avoids the RLS error.
create or replace function public.propose_event_for_group(
  p_place_id uuid, p_group_id uuid, p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_user_id uuid:=auth.uid(); v_event_id uuid; v_place record; v_lat double precision; v_lng double precision;
begin
  if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_place_id is null or p_group_id is null or p_starts_at is null then raise exception 'place, group, and start time are required' using errcode='22023'; end if;
  if not exists(select 1 from public.groups g where g.id=p_group_id and (g.created_by=v_user_id or exists(select 1 from public.group_members gm where gm.group_id=g.id and gm.user_id=v_user_id))) then raise exception 'not authorized to propose a meetup for this group' using errcode='42501'; end if;
  select * into v_place from public.places where id=p_place_id and active=true;
  if not found then raise exception 'place not found or inactive' using errcode='22023'; end if;
  v_lat:=coalesce(v_place.lat,v_place.latitude); v_lng:=coalesce(v_place.lng,v_place.longitude);
  if v_lat is null or v_lng is null then raise exception 'place has no verified coordinates' using errcode='22023'; end if;
  insert into public.events(title,venue_name,address,lat,lng,location_latitude,location_longitude,location_city,location_state,location_zip,place_id,proposed_by_group,added_by,starts_at,status,content_status,is_kid_relevant)
  values(v_place.name,v_place.name,v_place.address,v_lat,v_lng,v_lat,v_lng,v_place.city,v_place.state,v_place.zip_code,p_place_id,p_group_id,v_user_id,p_starts_at,'published','keep',true) returning id into v_event_id;
  insert into public.rsvps(event_id,user_id,status)
  values(v_event_id,v_user_id,'going')
  on conflict (event_id,user_id) do update set status='going';
  insert into public.group_proposal_notifications(event_id,group_id,recipient_id)
  select v_event_id,p_group_id,gm.user_id from public.group_members gm where gm.group_id=p_group_id and gm.user_id<>v_user_id on conflict do nothing;
  return v_event_id;
end; $function$;

grant execute on function public.propose_event_for_group(uuid, uuid, timestamptz) to authenticated;

-- Optional hardening: prod also grants EXECUTE to anon. The function raises on a
-- null auth.uid(), so anon calls fail safely, but you may tighten it:
--   revoke execute on function public.propose_event_for_group(uuid, uuid, timestamptz) from anon;

commit;
