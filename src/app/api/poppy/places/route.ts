import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoutingProvider } from "@/lib/routing";
import { isFreeCost } from "@/lib/cost";
import { parseIntent } from "@/lib/recommend/intent";
import { filterPlaces } from "@/lib/recommend/filter";
import { goodAgeFit, scorePlace } from "@/lib/recommend/score";
import type { PoppyProfile, RecommendationCandidate } from "@/lib/recommend/types";
import type { Place } from "@/types";

const MAX_RESULTS = 3;
const MAX_POOL = 250;
const ROUTE_POOL = 50;
const SERVICE_RADIUS_MILES = 30;
const MAX_DRIVE_MINUTES = 45;

function toProfile(row: Record<string, unknown> | null): PoppyProfile {
  const arr=(v:unknown)=>Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[];
  const num=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;
  const str=(v:unknown)=>typeof v==="string"&&v.trim()?v:null;
  return {childAgeMonths:num(row?.child_age_months),childInterests:arr(row?.child_interests),childActivityPreferences:arr(row?.child_activity_preferences),preferredCategories:arr(row?.preferred_categories),preferredPlaceTypes:arr(row?.preferred_place_types),indoorPreference:row?.indoor_preference==="indoor"||row?.indoor_preference==="outdoor"?row.indoor_preference:"either",maxDistanceMiles:num(row?.max_distance_miles),familyBudgetNote:str(row?.family_budget_note),napStart:str(row?.nap_start),napEnd:str(row?.nap_end),homeLat:num(row?.home_lat),homeLng:num(row?.home_lng)};
}

type RankedPlace={place:Place;miles:number|null;score:number;driveMinutes?:number};

export async function POST(request:Request){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Please sign in."},{status:401});
  let body:Record<string,unknown>={};try{body=await request.json() as Record<string,unknown>;}catch{}
  const message=typeof body.message==="string"?body.message.slice(0,400):"";
  const originMode=body.originMode==="current"?"current":"home";
  const {data:profileRow,error:profileError}=await supabase.from("profiles").select("child_age_months, child_interests, child_activity_preferences, preferred_categories, preferred_place_types, indoor_preference, max_distance_miles, family_budget_note, nap_start, nap_end, home_lat, home_lng").eq("id",user.id).maybeSingle();
  if(profileError)return NextResponse.json({error:"Could not load your Poppy profile."},{status:500});
  const profile=toProfile(profileRow as Record<string,unknown>|null);
  let origin=profile.homeLat!=null&&profile.homeLng!=null?{lat:profile.homeLat,lng:profile.homeLng}:null;
  if(originMode==="current"){const supplied=body.origin as Record<string,unknown>|undefined;if(supplied&&typeof supplied.lat==="number"&&typeof supplied.lng==="number"&&Number.isFinite(supplied.lat)&&Number.isFinite(supplied.lng))origin={lat:supplied.lat,lng:supplied.lng};}
  const constraints=parseIntent(message);
  constraints.maxMiles=Math.min(constraints.maxMiles??profile.maxDistanceMiles??SERVICE_RADIUS_MILES,SERVICE_RADIUS_MILES);
  const {data:rows,error}=await supabase.from("places").select("*").eq("active",true).eq("llm_verification_status","verified").limit(MAX_POOL);
  if(error)return NextResponse.json({error:"Could not load family places."},{status:500});
  const filtered=filterPlaces((rows??[]) as Place[],constraints,origin);
  const ranked:RankedPlace[]=filtered.kept.map(({place,miles})=>({place,miles,score:scorePlace(place,miles,constraints,profile,null)})).sort((a,b)=>b.score-a.score);

  // The 30-mile straight-line ceiling is only a defense-in-depth candidate
  // pool bound. With a saved/current origin, Poppy's actual proximity gate is
  // routing: a candidate is eligible only when a routing provider returns a
  // finite drive time <= 45 minutes. If routing is unavailable we fail closed
  // rather than claim a drive-time guarantee we could not verify.
  const routePool=ranked.slice(0,ROUTE_POOL);
  const routingProvider=origin?getRoutingProvider():null;
  let selected:RankedPlace[]=[];
  if(!origin){
    selected=ranked.slice(0,MAX_RESULTS);
  }else if(routingProvider&&routePool.length){
    const points=routePool.map(item=>({id:item.place.id,lat:item.place.lat??item.place.latitude,lng:item.place.lng??item.place.longitude})).filter((p):p is {id:string;lat:number;lng:number}=>p.lat!=null&&p.lng!=null);
    try{
      const results=await routingProvider.getDriveTimes(origin,points.map(p=>({lat:p.lat,lng:p.lng})));
      const byId=new Map<string,number>();
      points.forEach((p,i)=>{const minutes=results[i]?.durationMinutes;if(typeof minutes==="number"&&Number.isFinite(minutes))byId.set(p.id,Math.round(minutes));});
      selected=routePool.filter(item=>{const minutes=byId.get(item.place.id);if(minutes==null||minutes>MAX_DRIVE_MINUTES)return false;item.driveMinutes=minutes;return true;}).slice(0,MAX_RESULTS);
    }catch{selected=[];}
  }

  const candidates:RecommendationCandidate[]=selected.map(({place,miles,score,driveMinutes})=>{
    const fit=goodAgeFit(profile.childAgeMonths,place.age_min_months,place.age_max_months);
    const interest=profile.childInterests.find(i=>{const tags:Record<string,string[]>={playgrounds:["playground"],water:["water_play"],adventure:["active_play","outdoor"],sports:["active_play","playground"],animals:["animals"],books:["storytime"],arts_and_crafts:["arts_learning"],science:["arts_learning"],music:["arts_learning"]};return(tags[i]??[]).some(tag=>place.category_tags.includes(tag));});
    const reasons=[fit&&profile.childAgeMonths!=null?"fits their age":null,interest?`matches ${interest.replaceAll("_"," ")}`:null,isFreeCost(place.price_note)?"free":null,miles!=null?`${miles<10?miles.toFixed(1):Math.round(miles)} mi away`:null,driveMinutes!=null?`${driveMinutes} min drive`:null].filter(Boolean);
    return {type:"place",id:place.id,title:place.name,description:place.toddler_notes??place.description,address:place.address,distanceMiles:miles,driveMinutes:driveMinutes??null,distanceLabel:miles==null?null:`~${miles<10?miles.toFixed(1):Math.round(miles)} mi away`,startsAt:null,endsAt:null,price:place.price_note,isFree:isFreeCost(place.price_note),isOutdoor:place.is_outdoor,ageMinMonths:place.age_min_months,ageMaxMonths:place.age_max_months,goodAgeFit:fit,reason:reasons.length?`Good option — ${reasons.join(" · ")}.`:"A family-friendly option.",href:`/places/${place.id}`,lastVerifiedAt:place.last_verified_at,score,whatToBring:place.what_to_bring??[],strollerAccessible:place.stroller_accessible,changingTable:place.has_changing_table,nursingFriendly:place.nursing_friendly,parkingNotes:place.parking_notes,typicalCrowdNote:place.typical_crowd_note,bestTimeNote:place.best_time_note,registrationRequired:false};
  });
  return NextResponse.json({candidates,source:"evergreen-places",locationStatus:origin?(routingProvider?"route_verified":"route_unavailable"):"missing"});
}
