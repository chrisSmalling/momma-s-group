-- Final runtime hardening reconciliation.
-- These statements are intentionally idempotent so the repository can reproduce
-- the production-safe state reached during the 2026-08-26 audit.

-- Authenticated members need this helper for RLS-backed membership checks.
grant execute on function public.is_member(uuid) to authenticated;
revoke execute on function public.is_member(uuid) from anon;

-- Keep fuzzy duplicate detection explicit about the extension schema after
-- pg_trgm was moved out of public.
create or replace function public.refresh_fuzzy_event_duplicate_clusters()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  n integer := 0;
  r record;
  k text;
begin
  for r in
    select
      a.id a_id,
      b.id b_id,
      a.title a_title,
      a.starts_at a_starts_at,
      a.venue_name a_venue_name,
      extensions.similarity(
        lower(regexp_replace(a.title,'[^a-z0-9 ]','','g')),
        lower(regexp_replace(b.title,'[^a-z0-9 ]','','g'))
      ) sim
    from public.events a
    join public.events b on a.id < b.id
      and a.status = 'published'
      and b.status = 'published'
      and date_trunc('minute', a.starts_at at time zone 'America/New_York') =
          date_trunc('minute', b.starts_at at time zone 'America/New_York')
      and lower(trim(coalesce(a.venue_name,''))) = lower(trim(coalesce(b.venue_name,'')))
    where extensions.similarity(
      lower(regexp_replace(a.title,'[^a-z0-9 ]','','g')),
      lower(regexp_replace(b.title,'[^a-z0-9 ]','','g'))
    ) >= 0.88
  loop
    k := md5(
      lower(regexp_replace(trim(r.a_title),'[^a-z0-9]+',' ','g')) || '|' ||
      date(r.a_starts_at at time zone 'America/New_York') || '|' ||
      date_trunc('minute', r.a_starts_at at time zone 'America/New_York') || '|' ||
      lower(trim(coalesce(r.a_venue_name,'')))
    );

    insert into public.event_duplicate_clusters(
      cluster_key, event_ids, confidence, reason, status
    ) values (
      k,
      array[r.a_id, r.b_id],
      case when r.sim >= 0.95 then 95 else 88 end,
      'Fuzzy title match with same local start time, local date, and venue',
      'pending'
    )
    on conflict (cluster_key) do update set
      event_ids = excluded.event_ids,
      confidence = greatest(public.event_duplicate_clusters.confidence, excluded.confidence),
      reason = case
        when excluded.confidence > public.event_duplicate_clusters.confidence
          then excluded.reason
        else public.event_duplicate_clusters.reason
      end,
      updated_at = now();

    n := n + 1;
  end loop;

  return n;
end;
$$;

-- recommendation_requests.intent is already the recommendation_intent enum in
-- production. This assertion makes future migrations fail loudly if that
-- invariant ever regresses, without performing a destructive cast.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recommendation_requests'
      and column_name = 'intent'
      and udt_schema = 'public'
      and udt_name = 'recommendation_intent'
  ) then
    raise exception 'recommendation_requests.intent must use public.recommendation_intent';
  end if;
end;
$$;
