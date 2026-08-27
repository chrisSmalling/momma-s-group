import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/types";
import { eventWithinTimeframe, filterEvents } from "./filter";
import { parseIntent } from "./intent";
import type { RecommendationConstraints } from "./types";

const base: RecommendationConstraints={mood:"all",indoor:"either",budget:"any",maxMiles:null,maxPriceDollars:null,distanceExplicit:false,timeframe:"any",timeOfDay:"any",indoorExplicit:false};
const origin={lat:28.2,lng:-82.4};
function event(lat:number|null,lng:number|null,startsAt="2026-08-27T10:00:00-04:00",endsAt?:string,experienceType="general"):FeedEvent{return{id:crypto.randomUUID(),title:"Activity",description:null,venue:"Venue",room_name:null,organizer:null,address:"1 Main St",lat,lng,location_latitude:null,location_longitude:null,starts_at:startsAt,ends_at:endsAt??new Date(new Date(startsAt).getTime()+60*60*1000).toISOString(),time_precision:"exact",time_unknown:false,cost:"Free",is_free:true,age_tags:[],age_min_months:null,age_max_months:null,age_band:null,is_outdoor:false,what_to_bring:[],registration_required:false,registration_url:null,source:"test",source_id:null,source_url:null,content_status:"keep",geography_tier:"pasco",experience_type:experienceType,weather_fit:"indoor",place_id:null,program_id:null,proposed_by_group:null,metro_area:"pasco",status:"published",last_verified_at:null,added_by:null};}

describe("proximity semantics",()=>{
 it("marks close and near-me language as explicit proximity",()=>{expect(parseIntent("what's close?").distanceExplicit).toBe(true);expect(parseIntent("find something near me").distanceExplicit).toBe(true);});
 it("does not surface an unknown-distance candidate for an explicit proximity request",()=>{const {kept}=filterEvents([event(null,null)],{...base,maxMiles:8,distanceExplicit:true},origin,new Date("2026-08-26T12:00:00Z"));expect(kept).toHaveLength(0);});
 it("keeps unknown distance for the default local-first search",()=>{const {kept}=filterEvents([event(null,null)],{...base,maxMiles:20,distanceExplicit:false},origin,new Date("2026-08-26T12:00:00Z"));expect(kept).toHaveLength(1);});
 it("uses a 45-mile defense-in-depth prefilter while leaving final eligibility to routing",()=>{const inside=filterEvents([event(28.2,-81.75)],{...base,maxMiles:60,distanceExplicit:false},origin,new Date("2026-08-26T12:00:00Z"));const outside=filterEvents([event(28.2,-81.6)],{...base,maxMiles:60,distanceExplicit:false},origin,new Date("2026-08-26T12:00:00Z"));expect(inside.kept).toHaveLength(1);expect(outside.kept).toHaveLength(0);});
});

describe("Eastern calendar semantics",()=>{
 it("uses the user's Eastern calendar day even when UTC has crossed midnight",()=>{const now=new Date("2026-08-28T02:30:00Z");expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-27T23:30:00-04:00"),"today",now)).toBe(true);expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-28T00:30:00-04:00"),"today",now)).toBe(false);});
 it("keeps tomorrow anchored to Eastern local dates",()=>{const now=new Date("2026-08-28T02:30:00Z");expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-28T23:00:00-04:00"),"tomorrow",now)).toBe(true);});
 it("handles Friday-to-Sunday weekend boundaries",()=>{const now=new Date("2026-08-28T16:00:00Z");expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-29T10:00:00-04:00"),"weekend",now)).toBe(true);expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-30T10:00:00-04:00"),"weekend",now)).toBe(true);expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-31T10:00:00-04:00"),"weekend",now)).toBe(false);});
 it("does not leak Monday into a Sunday weekend request",()=>{const now=new Date("2026-08-30T15:00:00-04:00");expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-30T16:00:00-04:00"),"weekend",now)).toBe(true);expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-31T10:00:00-04:00"),"weekend",now)).toBe(false);});
 it("treats evergreen places as available across calendar filters",()=>{const now=new Date("2026-08-28T16:00:00Z");expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-28T12:00:00-04:00",undefined,"evergreen_place"),"tomorrow",now)).toBe(true);expect(eventWithinTimeframe(event(28.2,-82.4,"2026-08-28T12:00:00-04:00",undefined,"evergreen_place"),"weekend",now)).toBe(true);});
});
