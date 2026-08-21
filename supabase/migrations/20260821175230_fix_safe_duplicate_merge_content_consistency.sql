create or replace function public.merge_safe_event_duplicates()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  c record;
  keeper uuid;
  dup uuid;
  merged_count integer := 0;
  skipped_count integer := 0;
  ids uuid[];
begin
  for c in select * from public.event_duplicate_clusters where status='pending' and confidence >= 95 order by created_at loop
    ids := c.event_ids;
    select e.id into keeper
    from public.events e
    where e.id = any(ids) and e.status='published'
    order by e.verification_score desc, e.feed_score desc, e.last_verified_at desc nulls last, e.created_at asc
    limit 1;

    if keeper is null then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    for dup in select x from unnest(ids) as x where x <> keeper loop
      if exists(select 1 from public.rsvps where event_id=dup)
         or exists(select 1 from public.event_comments where event_id=dup)
         or exists(select 1 from public.outing_feedback where event_id=dup)
         or exists(select 1 from public.place_tips where event_id=dup) then
        skipped_count := skipped_count + 1;
        continue;
      end if;

      update public.activity_source_records
      set resolved_event_id=keeper,
          verification_status=case when verification_status='cancelled' then verification_status else 'verified' end
      where resolved_event_id=dup;

      update public.events
      set duplicate_of_event_id=keeper,
          status='cancelled',
          content_status='exclude',
          is_kid_relevant=false,
          content_review_status='auto_approved',
          content_review_reason='Duplicate of canonical event '||keeper::text,
          content_verified_at=now()
      where id=dup and status='published';

      merged_count := merged_count + 1;
    end loop;

    if not exists(
      select 1 from public.events e
      where e.id=any(ids) and e.status='published' and e.id<>keeper
    ) then
      update public.event_duplicate_clusters
      set status='merged', updated_at=now()
      where id=c.id;
    end if;
  end loop;

  return jsonb_build_object('merged_events',merged_count,'skipped_events',skipped_count);
end;
$function$;
