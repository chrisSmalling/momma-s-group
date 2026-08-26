// Poppy recommendation contract + internal types.
//
// This module is intentionally free of any Supabase / network dependency so
// the intent parsing, filtering, scoring and ranking can be unit-tested as
// pure functions. The route handler (src/app/api/poppy/recommend) is the
// only place that touches the database; it feeds already-fetched, typed rows
// into these helpers.

import type { FeedEvent, Place } from "@/types";

export type IndoorPreference = "indoor" | "outdoor" | "either";
export type BudgetPreference = "free" | "budget" | "any";
export type Timeframe = "today" | "tomorrow" | "weekend" | "any";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";

// The subset of profile columns the recommender actually reads. Kept narrow
// on purpose (Phase 16 data-safety): only what materially affects ranking.
export interface PoppyProfile {
  childAgeMonths: number | null;
  childInterests: string[];
  childActivityPreferences: string[];
  preferredCategories: string[];
  preferredPlaceTypes: string[];
  indoorPreference: IndoorPreference;
  maxDistanceMiles: number | null;
  familyBudgetNote: string | null;
  napStart: string | null;
  napEnd: string | null;
  homeLat: number | null;
  homeLng: number | null;
}

// Normalized, structured request. This is what a follow-up ("something
// closer") mutates — never a re-built free-text prompt.
export interface RecommendationConstraints {
  mood: Mood;
  indoor: IndoorPreference;
  budget: BudgetPreference;
  maxMiles: number | null;
  timeframe: Timeframe;
  timeOfDay: TimeOfDay;
  indoorExplicit: boolean;
}

export type Mood =
  | "all"
  | "indoor"
  | "outdoor"
  | "water"
  | "active"
  | "learn"
  | "create"
  | "animals";

export interface RecommendationRequest {
  message: string;
  previous?: Partial<RecommendationConstraints>;
  originMode?: "home" | "current";
  origin?: { lat: number; lng: number } | null;
}

export type CandidateType = "place" | "event";

export interface RecommendationCandidate {
  type: CandidateType;
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  distanceMiles: number | null;
  driveMinutes: number | null;
  distanceLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  price: string | null;
  isFree: boolean;
  isOutdoor: boolean | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  goodAgeFit: boolean;
  reason: string;
  href: string;
  // Source freshness is a real data signal, not generated copy.
  lastVerifiedAt: string | null;
  score: number;
}

export interface RecommendationResult {
  requestId: string;
  intent: RecommendationConstraints;
  candidates: RecommendationCandidate[];
  responseText: string;
  fallbacks: FallbackAction[];
  cacheHit: boolean;
}

export interface FallbackAction {
  key: string;
  label: string;
  patch: Partial<RecommendationConstraints>;
}

export interface CandidateInputs {
  places: Place[];
  events: FeedEvent[];
}
