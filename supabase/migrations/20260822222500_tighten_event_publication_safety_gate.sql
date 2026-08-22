-- Tighten the final publication gate so keep events cannot bypass
-- geographic, timing, verification, or duplicate-lineage safety.
create or replace function public.enforce_event_publication_safety()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.status = 'published' and new.content_status = 'keep' then
    if coalesce(new.is_kid_relevant,false) = false
       or coalesce(new.is_suppressed,false)
       or new.duplicate_of is not null
       or new.duplicate_of_event_id is not null
       or coalesce(new.verification_score,0) < 80
       or (new.source_id is null and new.added_by is null)
       or coalesce(new.lat,new.location_latitude) is null
       or coalesce(new.lng,new.location_longitude) is null
       or coalesce(new.event_time_known,false) = false
    then
      new.content_status = 'review';
    end if;
  end if;
  return new;
end;
$function$;

revoke execute on function public.enforce_event_publication_safety() from anon, authenticated;
grant execute on function public.enforce_event_publication_safety() to postgres, service_role;
