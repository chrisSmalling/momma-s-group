import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/types";
import { filterEvents } from "./filter";
import { parseIntent } from "./intent";
import type { RecommendationConstraints } from "./types";

const base: RecommendationConstraints={mood:"all",indoor:"either",budget:"any",maxMiles:null,maxPriceDollars:null,distanceExplicit:false,timeframe:"any",timeOfDay:"any",indoorExplicit:false};
const origin={lat:28.2,lng:-82.4};
function event(lat:number|null,lng:number|null):FeedEvent{return{id:crypto.randomUUID(),title:"Activity",description:null,venue:"Venue",room_name:null,organizer:null,address:"1 Main St",lat,lng,location_latitude:null,location_longitude:null,starts_at:"2026-08-27T10:00:00-04:00",ends_at:"2026-08-27T11:00:00-04:00",time_precision:"exact",time_unknown:false,cost:"Free",is_free:true,age_tags:[],age_min_months:null,age_max_months:null,age_band:null,is_outdoor:false,what_to_bring:[],registration_required:false,registration_url:null,source:"test",source_id:null,source_url:null,content_status:"keep",geography_tier:"pasco",experience_type:"general",weather_fit:"indoor",place_id:null,program_id:null,proposed_by_group:null,metro_area:"pasco",status:"published",last_verified_at:null,added_by:null};}

describe("proximity semantics",()=>{
 it("marks close and near-me language as explicit proximity",()=>{expect(parseIntent("what's close?").distanceExplicit).toBe(true);expect(parseIntent("find something near me").distanceExplicit).toBe(true);});
 it("does not surface an unknown-distance candidate for an explicit proximity request",()=>{const {kept}=filterEvents([event(null,null)],{...base,maxMiles:8,distanceExplicit:true},origin,new Date("2026-08-26T12:00:00Z"));expect(kept).toHaveLength(0);});
 it("keeps unknown distance for the default local-first search",()=>{const {kept}=filterEvents([event(null,null)],{...base,maxMiles:20,distanceExplicit:false},origin,new Date("2026-08-26T12:00:00Z"));expect(kept).toHaveLength(1);});
});
