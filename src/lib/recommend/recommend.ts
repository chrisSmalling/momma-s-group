// Orchestrates the deterministic recommendation pipeline:
// filter (hard constraints) -> score -> rank -> structured candidates.
// Pure: the route handler fetches rows + weather and passes them in.

import { isFreeCost } from "@/lib/cost";
import type { WeatherContext } from "@/lib/weather-context";
import type { FeedEvent, Place } from "@/types";
import { filterEvents, filterPlaces } from "./filter";
import { goodAgeFit, scoreEvent, scorePlace } from "./score";
import { buildResponseText } from "./text";
import type {
  CandidateInputs,
  FallbackAction,
  PoppyProfile,
  RecommendationCandidate,
  RecommendationConstraints,
} from "./types";

const MAX_RESULTS = 5;

function distanceLabel(miles: number | null): string | null {
  if (miles == null) return null;
  const rounded = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `~${rounded} mi away`;
}

function placeReason(place: Place, miles: number | null, fit: boolean, profile: PoppyProfile): string {
  const bits: string[] = [];
  if (fit && profile.childAgeMonths != null) {
    const years = Math.floor(profile.childAgeMonths / 12);
    bits.push(years >= 1 ? `a good fit for your ${years}-year-old` : "a good fit for your little one");
  }
  if (miles != null && miles <= 10) bits.push(`only ${miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles away`);
  if (isFreeCost(place.price_note)) bits.push("and it's free");
  const matchedInterest = profile.childInterests.find((i) =>
    (i === "animals" && place.category_tags.includes("animals")) ||
    (i === "water" && place.category_tags.includes("water_play")) ||
    (i === "playgrounds" && place.category_tags.includes("playground")),
  );
  if (matchedInterest) bits.push(`right up their alley`);
  if (bits.length === 0) return place.is_outdoor ? "A solid outdoor pick nearby." : "A solid nearby pick.";
  const sentence = bits.join(", ").replace(", and", " and");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

function eventReason(event: FeedEvent, miles: number | null, fit: boolean, profile: PoppyProfile): string {
  const bits: string[] = [];
  if (fit && profile.childAgeMonths != null) {
    const years = Math.floor(profile.childAgeMonths / 12);
    bits.push(years >= 1 ? `great for your ${years}-year-old` : "great for your little one");
  }
  if (event.is_free) bits.push("free");
  if (miles != null && miles <= 12) bits.push(`close by (~${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi)`);
  if (bits.length === 0) return "Happening soon and worth a look.";
  const sentence = bits.join(", ");
  return "Looks " + sentence + ".";
}

export function recommend(
  inputs: CandidateInputs,
  constraints: RecommendationConstraints,
  profile: PoppyProfile,
  origin: { lat: number; lng: number } | null,
  weather: WeatherContext | null,
  now: Date,
): { candidates: RecommendationCandidate[]; droppedCount: number } {
  const placesFiltered = filterPlaces(inputs.places, constraints, origin);
  const eventsFiltered = filterEvents(inputs.events, constraints, origin, now);

  const placeCandidates: RecommendationCandidate[] = placesFiltered.kept.map(({ place, miles }) => {
    const fit = goodAgeFit(profile.childAgeMonths, place.age_min_months, place.age_max_months);
    return {
      type: "place" as const,
      id: place.id,
      title: place.name,
      description: place.toddler_notes ?? place.description,
      address: place.address,
      distanceMiles: miles,
      driveMinutes: null,
      distanceLabel: distanceLabel(miles),
      startsAt: null,
      endsAt: null,
      price: place.price_note,
      isFree: isFreeCost(place.price_note),
      isOutdoor: place.is_outdoor,
      ageMinMonths: place.age_min_months,
      ageMaxMonths: place.age_max_months,
      goodAgeFit: fit,
      reason: placeReason(place, miles, fit, profile),
      href: `/places/${place.id}/propose`,
      score: scorePlace(place, miles, constraints, profile, weather),
    };
  });

  const eventCandidates: RecommendationCandidate[] = eventsFiltered.kept.map(({ event, miles }) => {
    const fit = goodAgeFit(profile.childAgeMonths, event.age_min_months, event.age_max_months);
    return {
      type: "event" as const,
      id: event.id,
      title: event.title,
      description: event.description,
      address: event.address ?? event.venue,
      distanceMiles: miles,
      driveMinutes: null,
      distanceLabel: distanceLabel(miles),
      startsAt: event.time_unknown ? null : event.starts_at,
      endsAt: event.ends_at,
      price: event.cost,
      isFree: event.is_free,
      isOutdoor: event.is_outdoor,
      ageMinMonths: event.age_min_months,
      ageMaxMonths: event.age_max_months,
      goodAgeFit: fit,
      reason: eventReason(event, miles, fit, profile),
      href: `/events/${event.id}`,
      score: scoreEvent(event, miles, constraints, profile, weather),
    };
  });

  const ranked = [...placeCandidates, ...eventCandidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS);

  const droppedCount = placesFiltered.droppedCount + eventsFiltered.droppedCount;
  return { candidates: ranked, droppedCount };
}

// Actionable fallbacks when nothing matched (Phase 14). Each carries a
// constraint patch the UI re-sends — no fabricated results.
export function buildFallbacks(constraints: RecommendationConstraints): FallbackAction[] {
  const actions: FallbackAction[] = [];
  if (constraints.maxMiles != null) {
    actions.push({
      key: "farther",
      label: "Search farther",
      patch: { maxMiles: Math.min(60, Math.round((constraints.maxMiles ?? 15) * 2)) },
    });
  }
  if (constraints.indoor !== "indoor") {
    actions.push({ key: "indoors", label: "Try indoors", patch: { indoor: "indoor", indoorExplicit: true, mood: "indoor" } });
  }
  if (constraints.indoor !== "outdoor") {
    actions.push({ key: "outdoors", label: "Try outdoors", patch: { indoor: "outdoor", indoorExplicit: true, mood: "outdoor" } });
  }
  if (constraints.timeframe !== "any") {
    actions.push({ key: "anyday", label: "Try another day", patch: { timeframe: "any" } });
  }
  actions.push({
    key: "anything",
    label: "Show anything nearby",
    patch: { mood: "all", indoor: "either", indoorExplicit: false, budget: "any" },
  });
  return actions;
}

export { buildResponseText };
