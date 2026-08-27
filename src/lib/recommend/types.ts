// Poppy recommendation contract + internal types.
import type { FeedEvent, PlaceHours } from "@/types";
export type IndoorPreference = "indoor" | "outdoor" | "either";
export type BudgetPreference = "free" | "budget" | "any";
export type Timeframe = "today" | "tomorrow" | "weekend" | "any";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";
export interface PoppyProfile { childAgeMonths:number|null; childInterests:string[]; childActivityPreferences:string[]; preferredCategories:string[]; preferredPlaceTypes:string[]; indoorPreference:IndoorPreference; maxDistanceMiles:number|null; familyBudgetNote:string|null; napStart:string|null; napEnd:string|null; homeLat:number|null; homeLng:number|null; }
export interface RecommendationConstraints { mood:Mood; indoor:IndoorPreference; budget:BudgetPreference; maxMiles:number|null; maxPriceDollars?:number|null; distanceExplicit?:boolean; timeframe:Timeframe; timeOfDay:TimeOfDay; indoorExplicit:boolean; }
export type Mood="all"|"indoor"|"outdoor"|"water"|"active"|"learn"|"create"|"animals";
export interface RecommendationRequest { message:string; previous?:Partial<RecommendationConstraints>; originMode?:"home"|"current"; origin?:{lat:number;lng:number}|null; }
export type CandidateType="place"|"event";
export interface RecommendationCandidate { type:CandidateType; id:string; title:string; description:string|null; address:string|null; distanceMiles:number|null; driveMinutes:number|null; distanceLabel:string|null; startsAt:string|null; endsAt:string|null; price:string|null; isFree:boolean; isOutdoor:boolean|null; ageMinMonths:number|null; ageMaxMonths:number|null; goodAgeFit:boolean; reason:string; href:string; lastVerifiedAt:string|null; score:number; whatToBring:string[]; strollerAccessible:boolean|null; changingTable:boolean|null; nursingFriendly:boolean|null; parkingNotes:string|null; typicalCrowdNote:string|null; bestTimeNote:string|null; registrationRequired:boolean; communityTips?:string[]; }
export interface RecommendationResult { requestId:string; intent:RecommendationConstraints; candidates:RecommendationCandidate[]; responseText:string; fallbacks:FallbackAction[]; cacheHit:boolean; }
export interface FallbackAction { key:string; label:string; patch:Partial<RecommendationConstraints>; }
// Phase A (honest unified candidate model): the one shape both events and
// places flow through. An event has a real, fixed occurrence (starts_at/
// ends_at); a place has none — hours/season_start/season_end define its own
// eligibility instead (see filter.ts's per-kind eligibility functions).
// Deliberately NOT FeedEvent: FeedEvent.starts_at/registration_required are
// always real, non-null values everywhere else in the app (calendar, today,
// plans), and widening those there for this one pipeline would force every
// one of those call sites to null-check a value that, for them, is never
// actually null.
export type PoppyCandidate = Omit<FeedEvent, "starts_at" | "ends_at" | "registration_required"> & {
  kind: CandidateType;
  starts_at: string | null;
  ends_at: string | null;
  registration_required: boolean | null;
  hours: PlaceHours | null;
  season_start: string | null;
  season_end: string | null;
};
export interface CandidateInputs { events:PoppyCandidate[]; }
