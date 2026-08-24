-- Production event truth guardrails
-- Safe to rerun: all functions/views/triggers are replaced idempotently.

create or replace function public.normalize_event_text(input text)
returns text
language plpgsql
immutable
as $$
declare v text := coalesce(input,'');
begin
  v := replace(v,'&lt;','<'); v := replace(v,'&gt;','>'); v := replace(v,'&amp;','&'); v := replace(v,'&quot;','"'); v := replace(v,'&#39;',''''); v := replace(v,'&hellip;','…');
  v := replace(v,chr(92)||'n',' '); v := replace(v,chr(92)||',',','); v := replace(v,chr(92)||'.','.'); v := replace(v,chr(92)||':',':'); v := replace(v,chr(92)||';',';'); v := replace(v,chr(92)||'!','!'); v := replace(v,chr(92)||'?','?');
  v := regexp_replace(v,'<[^>]+>',' ','g'); v := regexp_replace(v,'\\s+',' ','g');
  return nullif(trim(v),'');
end;
$$;

create or replace function public.normalize_event_text_fields()
returns trigger
language plpgsql
as $$
begin
  new.title := public.normalize_event_text(new.title); new.description := public.normalize_event_text(new.description); new.venue_name := public.normalize_event_text(new.venue_name); new.venue_display := public.normalize_event_text(new.venue_display); new.organizer := public.normalize_event_text(new.organizer); new.room_name := public.normalize_event_text(new.room_name); new.address := public.normalize_event_text(new.address); new.cost := public.normalize_event_text(new.cost); new.display_title := public.normalize_event_text(new.display_title); return new;
end;
$$;

drop trigger if exists trg_normalize_event_text_fields on public.events;
create trigger trg_normalize_event_text_fields before insert or update of title,description,venue_name,venue_display,organizer,room_name,address,cost,display_title on public.events for each row execute function public.normalize_event_text_fields();

create or replace function public.recurrence_occurrence_matches(ts timestamptz, rrule text)
returns boolean
language plpgsql
immutable
as $$
declare local_date date := (ts at time zone 'America/New_York')::date; freq text; byday text; setpos integer; target_dow integer; first_day date; last_day date; occurrence integer;
begin
  if rrule is null or rrule = '' then return true; end if;
  freq := substring(rrule from 'FREQ=([^;]+)'); byday := substring(rrule from 'BYDAY=([^;]+)');
  if freq='WEEKLY' and byday is not null then
    target_dow := case upper(byday) when 'MO' then 1 when 'TU' then 2 when 'WE' then 3 when 'TH' then 4 when 'FR' then 5 when 'SA' then 6 when 'SU' then 7 else null end;
    return target_dow is null or extract(isodow from local_date)=target_dow;
  end if;
  if freq='MONTHLY' and byday is not null then
    first_day := date_trunc('month',local_date)::date; last_day := (first_day + interval '1 month - 1 day')::date;
    if byday ~ '^-[0-9]+(MO|TU|WE|TH|FR|SA|SU)$' then
      setpos := substring(byday from '^(-[0-9]+)')::integer;
      target_dow := case upper(substring(byday from '(MO|TU|WE|TH|FR|SA|SU)$')) when 'MO' then 1 when 'TU' then 2 when 'WE' then 3 when 'TH' then 4 when 'FR' then 5 when 'SA' then 6 when 'SU' then 7 else null end;
      if target_dow is null or extract(isodow from local_date)<>target_dow then return false; end if;
      occurrence := floor((last_day-local_date)/7)::integer+1; return occurrence=abs(setpos);
    end if;
    if byday ~ '^(MO|TU|WE|TH|FR|SA|SU)$' then
      target_dow := case upper(byday) when 'MO' then 1 when 'TU' then 2 when 'WE' then 3 when 'TH' then 4 when 'FR' then 5 when 'SA' then 6 when 'SU' then 7 else null end;
      setpos := coalesce(substring(rrule from 'BYSETPOS=([0-9-]+)')::integer,1);
      if target_dow is null or extract(isodow from local_date)<>target_dow then return false; end if;
      occurrence := floor((local_date-first_day)/7)::integer+1; return occurrence=setpos;
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.guard_recurring_event_occurrence()
returns trigger language plpgsql as $$
declare rule text;
begin
  if new.program_id is not null then select r.rrule into rule from public.recurring_programs r where r.id=new.program_id; if rule is not null and not public.recurrence_occurrence_matches(new.starts_at,rule) then new.is_suppressed:=true; new.verification_reasons:=coalesce(new.verification_reasons,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('code','invalid_recurrence_occurrence','rrule',rule)); end if; end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_recurring_event_occurrence on public.events;
create trigger trg_guard_recurring_event_occurrence before insert or update of program_id,starts_at on public.events for each row execute function public.guard_recurring_event_occurrence();

create or replace function public.guard_source_verification()
returns trigger language plpgsql as $$
declare cs record;
begin
  if new.source_id is not null then
    select id,active,source_type,reliability_score,last_success_at,last_event_count into cs from public.content_sources where id=new.source_id;
    if coalesce(cs.active,false) and cs.source_type='structured_web' and coalesce(cs.reliability_score,0)>=95 and coalesce(cs.last_event_count,0)>0 and cs.last_success_at>=now()-interval '24 hours' then
      new.verification_tier:='trusted'; new.verification_score:=greatest(coalesce(new.verification_score,0),least(95,cs.reliability_score)); new.last_verified_at:=cs.last_success_at; new.content_verified_at:=cs.last_success_at; new.verification_reasons:=coalesce(new.verification_reasons,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('code','official_source_sync_verified','source_id',cs.id,'verified_at',cs.last_success_at));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_source_verification on public.events;
create trigger trg_guard_source_verification before insert or update of source_id,title,description,starts_at,ends_at,venue_name,address on public.events for each row execute function public.guard_source_verification();

update public.events set title=public.normalize_event_text(title),description=public.normalize_event_text(description),venue_name=public.normalize_event_text(venue_name),venue_display=public.normalize_event_text(venue_display),organizer=public.normalize_event_text(organizer),room_name=public.normalize_event_text(room_name),address=public.normalize_event_text(address),cost=public.normalize_event_text(cost),display_title=public.normalize_event_text(display_title);

update public.events e set is_suppressed=true,verification_reasons=coalesce(e.verification_reasons,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('code','invalid_recurrence_occurrence','rrule',r.rrule)) from public.recurring_programs r where e.program_id=r.id and e.status='published' and not e.is_suppressed and not public.recurrence_occurrence_matches(e.starts_at,r.rrule);

update public.places set active=false where active=true and last_verified_at is null;
update public.places set active=false where id='e97276c3-a3ca-4627-86a2-6f506db57766';

create or replace view public.feed_events as
select e.id,coalesce(e.display_title,e.title) as title,e.description,coalesce(e.venue_display,e.organizer,e.venue_name) as venue,e.room_name,e.organizer,e.address,coalesce(e.lat,e.location_latitude) as lat,coalesce(e.lng,e.location_longitude) as lng,e.location_latitude,e.location_longitude,e.starts_at,e.ends_at,e.time_precision,(e.time_precision='date_only') as time_unknown,e.cost,case when e.cost is null then false else lower(trim(e.cost))=any(array['free','no cost','$0','0','free admission']) end as is_free,e.age_tags,e.age_min_months,e.age_max_months,e.age_band,e.is_outdoor,e.what_to_bring,e.registration_required,e.registration_url,e.source,e.source_id,e.source_url,e.added_by,e.content_status,e.geography_tier,e.experience_type,e.weather_fit,e.today_priority,e.discovery_priority,e.feed_score,e.classification_confidence,e.recurring_score,e.one_time_score,e.recurrence_pattern,e.verification_score,e.verification_tier,e.verification_reasons,e.content_verified_at,e.place_id,e.program_id,e.proposed_by_group,e.metro_area,e.status,e.last_verified_at
from public.events e left join public.recurring_programs r on r.id=e.program_id
where e.status='published' and e.content_status='keep' and e.is_kid_relevant and not e.is_suppressed and e.duplicate_of is null and e.duplicate_of_event_id is null and e.verification_tier in ('trusted','high') and e.verification_score>=80 and e.last_verified_at is not null and e.last_verified_at>=now()-interval '7 days' and (r.id is null or public.recurrence_occurrence_matches(e.starts_at,r.rrule));

create or replace view public.feed_quality_audit as
select count(*) filter(where e.status='published' and e.starts_at>=now()) as upcoming_published,count(*) filter(where e.status='published' and e.starts_at>=now() and not e.is_suppressed and e.content_status='keep') as eligible_before_verification,count(*) filter(where e.status='published' and e.starts_at>=now() and not e.is_suppressed and e.content_status='keep' and (e.verification_tier not in ('trusted','high') or e.verification_score<80 or e.last_verified_at is null or e.last_verified_at<now()-interval '7 days')) as unsafe_records_blocked,count(*) filter(where e.status='published' and e.starts_at>=now() and not e.is_suppressed and e.program_id is not null and not public.recurrence_occurrence_matches(e.starts_at,r.rrule)) as invalid_recurrence_blocked,count(*) filter(where e.status='published' and e.starts_at>=now() and not e.is_suppressed and (e.description~*'<[^>]+>|&lt;|&gt;|\\\\1' or e.address~*'<[^>]+>|&lt;|&gt;|\\\\1')) as dirty_text_records from public.events e left join public.recurring_programs r on r.id=e.program_id;
