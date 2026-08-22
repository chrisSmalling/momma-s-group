create or replace function public.enforce_crawler_source_admission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare h text; p text;
begin
  if new.source_url is null then return new; end if;
  h=lower(split_part(split_part(new.source_url,'://',2), '/',1));
  if left(h,4)='www.' then h=substring(h from 5); end if;
  p=lower(coalesce(new.source_url,''));
  if h like 'careers.%' or h like 'help.%' or h like 'resources.%' or h like 'intercom.%'
     or h in ('hud.gov','eventeny.com','unitedparksinvestors.com','seaworld.org','seaworldparks.com','seaworldentertainment.com','google.com','maps.google.com','eventbrite.com','lp.constantcontactpages.com','tiktok.com','app.fulloutsoftware.com','clients.mindbodyonline.com')
     or p ~ '/(login|signin|account|cart|checkout|support|help|privacy|terms|merch|shop/products)(/|\\?|$)'
     or p ~ '(sesameplace.com/en/langhorne|sarasotafair.com|plantcitygov.com)'
  then
    new.active=false;
    new.last_error='quarantined: non-canonical, platform, or outside-market source';
    new.source_priority=least(coalesce(new.source_priority,30),10);
    new.discovery_priority=least(coalesce(new.discovery_priority,30),10);
  end if;

  if coalesce(new.consecutive_failures,0) >= 5 and new.active=true then
    new.active=false;
    new.discovery_channel='manual_required';
    new.last_error='quarantined: 5+ consecutive crawler failures; manual review required';
    new.source_priority=least(coalesce(new.source_priority,30),10);
    new.discovery_priority=least(coalesce(new.discovery_priority,30),10);
  end if;
  return new;
end;
$function$;
