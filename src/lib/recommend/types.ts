// Poppy recommendation contract + internal types.
import type { FeedEvent, Place } from "@/types";
export type IndoorPreference = "indoor" | "outdoor" | "either";
export type BudgetPreference = "free" | "budget" | "any";
export type Timeframe = "today" | "tomorrow" | "weekend" | "any";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";
export interface PoppyProfile { childAgeMonths: number | null; childInterests: string[]; childActivityPreferences: string[]; preferredCategories: string[]; preferredPlaceTypes: string[]; indoorPreference: IndoorPreference; maxDistanceMiles: number | null; familyBudgetNote: string | null; napStart: string | null; napEnd: string | null; homeLat: number | null; homeLng: number | null; }
export interface RecommendationConstraints { mood: Mood; indoor: IndoorPreference; budget: BudgetPreference; maxMiles: number | null; maxPriceDollars?: number | null; timeframe: Timeframe; timeOfDay: TimeOfDay; indoorExplicit: boolean; }
export type Mood = "all" | "indoor" | "outdoor" | "water" | "active" | "learn" | "create" | "animals";
export interface RecommendationRequest { message: string; previous?: Partial<RecommendationConstraints>; originMode?: "home" | "current"; origin?: { lat: number; lng: number } | null; }
export type CandidateType = "place" | "event";
export interface RecommendationCandidate {
  type: CandidateType; id: string; title: string; description: string | null; address: string | null;
  distanceMiles: number | null; driveMinutes: number | null; distanceLabel: string | null;
  startsAt: string | null; endsAt: string | null; price: string | null; isFree: boolean;
  isOutdoor: boolean | null; ageMinMonths: number | null; ageMaxMonths: number | null; goodAgeFit: boolean;
  reason: string; href: string; lastVerifiedAt: string | null; score: number;
  whatToBring: string[]; strollerAccessible: boolean | null; changingTable: boolean | null;
  nursingFriendly: boolean | null; parkingNotes: string | null; typicalCrowdNote: string | null; bestTimeNote: string | null;
}
export interface RecommendationResult { requestId: string; intent: RecommendationConstraints; candidates: RecommendationCandidate[]; responseText: string; fallbacks: FallbackAction[]; cacheHit: boolean; }
export interface FallbackAction { key: string; label: string; patch: Partial<RecommendationConstraints>; }
export interface CandidateInputs { places: Place[]; events: FeedEvent[]; }
