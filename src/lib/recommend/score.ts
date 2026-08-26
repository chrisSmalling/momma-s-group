// Candidate scoring (Phase 5). Reimplements the useful concepts from the
// Today page's todayEventScore (age fit, experience boosts, weather fit,
// registration friction) server-side, and layers profile personalization on
// top as ranking signals. Pure and side-effect free.

import { isFreeCost } from "@/lib/cost";
import { isGoodAgeFit } from "@/lib/ageFit";
import { weatherScore, type WeatherContext } from "@/lib/weather-context";
import type { FeedEvent, Place } from "@/types";
import type { PoppyProfile, RecommendationConstraints } from "./types";

function ageScore(min: number | null, max: number | null, age: number | null): number {
  if (age == null) return 0;
  const lo = min ?? 0;
  const hi = max ?? 144;
  if (age >= lo && age <= hi) return 40;
  if (age >= lo - 6 && age <= hi + 6) return 12;
  return -25;
}

function distanceScore(miles: number | null): number {
  if (miles == null) return 0;
  // Gentle decay, mirroring the Explorer's max(0, 25 - miles*1.1).
  return Math.max(0, 25 - miles * 1.1);
}

// Maps a profile interest token to the taxonomy values that satisfy it.
// Interests are collected as stable tokens (see the profile UI), so this
// mapping is the one bridge between "what the family likes" and the
// already-populated place/event taxonomy.
const INTEREST_TO_PLACE_TAGS: Record<string, string[]> = {
  animals: ["animals"],
  water: ["water_play"],
  sports: ["active_play", "playground"],
  playgrounds: ["playground"],
  arts_and_crafts: ["arts_learning"],
  books: ["storytime"],
  music: ["arts_learning"],
  science: ["arts_learning"],
  adventure: ["active_play", "outdoor"],
  trains: [],
  flying: [],
  food: [],
};

const INTEREST_TO_EVENT_EXPERIENCE: Record<string, string[]> = {
  animals: ["animal"],
  water: [],
  sports: ["music_movement"],
  playgrounds: [],
  arts_and_crafts: ["hands_on"],
  books: ["storytime_experience"],
  music: ["music_movement"],
  science: ["hands_on"],
  adventure: ["music_movement"],
  trains: ["vehicle"],
  flying: ["vehicle"],
  food: [],
};

function interestBoostPlace(place: Place, profile: PoppyProfile): number {
  let boost = 0;
  const wanted = new Set(profile.childInterests);
  for (const interest of wanted) {
    const tags = INTEREST_TO_PLACE_TAGS[interest] ?? [];
    if (tags.some((t) => place.category_tags.includes(t))) boost += 10;
  }
  if (profile.preferredCategories.some((c) => place.category_tags.includes(c))) boost += 8;
  if (place.place_type && profile.preferredPlaceTypes.includes(place.place_type)) boost += 8;
  return boost;
}

function interestBoostEvent(event: FeedEvent, profile: PoppyProfile): number {
  let boost = 0;
  const wanted = new Set(profile.childInterests);
  for (const interest of wanted) {
    const experiences = INTEREST_TO_EVENT_EXPERIENCE[interest] ?? [];
    if (event.experience_type && experiences.includes(event.experience_type)) boost += 10;
  }
  return boost;
}

// Soft indoor/outdoor preference — a signal only. When the request made it
// explicit it was already applied as a hard filter, so this just nudges when
// the request was neutral but the family has a standing preference.
function indoorPrefScore(isOutdoor: boolean | null, c: RecommendationConstraints, profile: PoppyProfile): number {
  if (c.indoorExplicit || isOutdoor == null) return 0;
  const pref = profile.indoorPreference;
  if (pref === "either") return 0;
  const matches = pref === "outdoor" ? isOutdoor === true : isOutdoor === false;
  return matches ? 8 : -6;
}

function budgetSignalFromNote(note: string | null): "free" | "budget" | "any" {
  const s = (note ?? "").toLowerCase();
  if (/free|no cost|no money/.test(s)) return "free";
  if (/cheap|budget|low.?cost|affordable/.test(s)) return "budget";
  return "any";
}

function budgetScore(isFree: boolean, c: RecommendationConstraints, profile: PoppyProfile): number {
  const effective = c.budget !== "any" ? c.budget : budgetSignalFromNote(profile.familyBudgetNote);
  if (effective === "free") return isFree ? 15 : -4;
  if (effective === "budget") return isFree ? 8 : 0;
  return 0;
}

const EXPERIENCE_BOOSTS: Record<string, number> = {
  community_helper: 24,
  animal: 22,
  vehicle: 22,
  storytime_experience: 20,
  sensory: 18,
  hands_on: 18,
  music_movement: 15,
  general: 0,
};

export function scorePlace(
  place: Place,
  miles: number | null,
  c: RecommendationConstraints,
  profile: PoppyProfile,
  weather: WeatherContext | null,
): number {
  let score = 20; // base: a curated, active place
  score += ageScore(place.age_min_months, place.age_max_months, profile.childAgeMonths);
  score += distanceScore(miles);
  score += weatherScore(weather, place.is_outdoor);
  score += interestBoostPlace(place, profile);
  score += indoorPrefScore(place.is_outdoor, c, profile);
  score += budgetScore(isFreeCost(place.price_note), c, profile);
  if (c.mood !== "all") score += 20; // matched the requested vibe
  if (place.toddler_notes) score += 6;
  if (place.stroller_accessible) score += 3;
  if (place.has_changing_table) score += 4;
  if (place.restrooms) score += 2;
  return score;
}

export function scoreEvent(
  event: FeedEvent,
  miles: number | null,
  c: RecommendationConstraints,
  profile: PoppyProfile,
  weather: WeatherContext | null,
): number {
  let score = 0;
  if (event.content_status === "keep") score += 20;
  if (event.geography_tier === "pasco") score += 12;
  else if (event.geography_tier === "tampa") score += 4;
  score += ageScore(event.age_min_months, event.age_max_months, profile.childAgeMonths);
  score += distanceScore(miles);
  score += weatherScore(weather, event.is_outdoor);
  score += EXPERIENCE_BOOSTS[event.experience_type ?? "general"] ?? 0;
  score += interestBoostEvent(event, profile);
  score += indoorPrefScore(event.is_outdoor, c, profile);
  score += budgetScore(event.is_free, c, profile);
  if (c.mood !== "all") score += 20;
  if (event.registration_required) score -= 2;
  return score;
}

export function goodAgeFit(childAgeMonths: number | null, min: number | null, max: number | null): boolean {
  return isGoodAgeFit(childAgeMonths, min, max);
}
