// Deterministic hard filters (Phase 4). Applied BEFORE scoring/ranking, and
// never overridden by any model output. Matching reuses the taxonomy the
// discovery pipeline already populates (places.category_tags/place_type,
// feed_events.experience_type/weather_fit) rather than inventing a second one.

import { isFreeCost } from "@/lib/cost";
import { distanceKm } from "@/lib/distance";
import type { FeedEvent, Place } from "@/types";
import type { Mood, RecommendationConstraints, Timeframe } from "./types";

const KM_PER_MILE = 1.609344;

export function milesBetween(
  origin: { lat: number; lng: number } | null,
  point: { lat: number | null; lng: number | null },
): number | null {
  if (!origin || point.lat == null || point.lng == null) return null;
  return distanceKm(origin.lat, origin.lng, point.lat, point.lng) / KM_PER_MILE;
}

export function moodMatchesPlace(p: Place, mood: Mood): boolean {
  if (mood === "all") return true;
  if (mood === "indoor") return p.category_tags.includes("indoor") || p.is_outdoor === false;
  if (mood === "outdoor") return p.category_tags.some((t) => t === "outdoor" || t === "playground") || p.is_outdoor === true;
  if (mood === "water") return p.category_tags.includes("water_play");
  if (mood === "active") return p.category_tags.some((t) => t === "active_play" || t === "playground");
  if (mood === "learn") return p.category_tags.includes("storytime") || p.category_tags.includes("arts_learning");
  if (mood === "create") return p.category_tags.includes("arts_learning");
  return p.category_tags.includes("animals");
}

export function moodMatchesEvent(e: FeedEvent, mood: Mood): boolean {
  if (mood === "all") return true;
  if (mood === "indoor") return e.weather_fit === "indoor" || e.is_outdoor === false;
  if (mood === "outdoor") return e.weather_fit === "outdoor" || e.is_outdoor === true;
  if (mood === "water") return e.weather_fit === "water";
  if (mood === "active") return e.experience_type === "music_movement";
  if (mood === "learn") return e.experience_type === "storytime_experience" || e.experience_type === "community_helper";
  if (mood === "create") return e.experience_type === "hands_on";
  return e.experience_type === "animal";
}

// Inclusive day boundaries in the app's operating timezone are approximated
// with local Date math, matching how the rest of the app treats event times
// (see src/lib/nap.ts — wall-clock, no explicit tz conversion).
export function eventWithinTimeframe(e: FeedEvent, timeframe: Timeframe, now: Date): boolean {
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : start;
  // Always exclude events that have already ended.
  if (end.getTime() < now.getTime()) return false;
  if (timeframe === "any") return true;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;

  if (timeframe === "today") {
    const endOfToday = new Date(startOfToday.getTime() + dayMs);
    return start.getTime() < endOfToday.getTime();
  }
  if (timeframe === "tomorrow") {
    const startOfTomorrow = new Date(startOfToday.getTime() + dayMs);
    const endOfTomorrow = new Date(startOfToday.getTime() + 2 * dayMs);
    return start.getTime() >= startOfTomorrow.getTime() && start.getTime() < endOfTomorrow.getTime();
  }
  // weekend: the coming Saturday + Sunday (or the current one if it's already
  // the weekend).
  const day = now.getDay(); // 0 Sun ... 6 Sat
  const daysUntilSat = (6 - day + 7) % 7;
  const satStart = new Date(startOfToday.getTime() + daysUntilSat * dayMs);
  const monStart = new Date(satStart.getTime() + 2 * dayMs);
  const rangeStart = day === 0 ? startOfToday : satStart; // if today is Sunday, include today
  return start.getTime() >= rangeStart.getTime() && start.getTime() < monStart.getTime();
}

function passesIndoorHardFilter(isOutdoor: boolean | null, c: RecommendationConstraints): boolean {
  if (!c.indoorExplicit || c.indoor === "either") return true;
  if (isOutdoor == null) return true; // unknown — don't drop, let it rank lower
  return c.indoor === "outdoor" ? isOutdoor === true : isOutdoor === false;
}

// budget === "free" is a hard filter only against *reliable* data: keep items
// that are known-free or whose cost is unknown; drop items known to cost
// money. "budget"/cheap stays a ranking signal (we have no numeric prices).
function passesBudgetHardFilter(cost: string | null, c: RecommendationConstraints): boolean {
  if (c.budget !== "free") return true;
  if (isFreeCost(cost)) return true;
  const hasKnownCost = Boolean(cost && cost.trim()) && !isFreeCost(cost);
  return !hasKnownCost;
}

function passesDistanceHardFilter(
  miles: number | null,
  c: RecommendationConstraints,
): boolean {
  if (c.maxMiles == null) return true;
  if (miles == null) return true; // unknown distance — keep, rank lower
  return miles <= c.maxMiles;
}

export interface FilteredPlace {
  place: Place;
  miles: number | null;
}
export interface FilteredEvent {
  event: FeedEvent;
  miles: number | null;
}

export function filterPlaces(
  places: Place[],
  c: RecommendationConstraints,
  origin: { lat: number; lng: number } | null,
): { kept: FilteredPlace[]; droppedCount: number } {
  let dropped = 0;
  const kept: FilteredPlace[] = [];
  for (const place of places) {
    if (!place.active) { dropped++; continue; }
    if (!moodMatchesPlace(place, c.mood)) { dropped++; continue; }
    if (!passesIndoorHardFilter(place.is_outdoor, c)) { dropped++; continue; }
    if (!passesBudgetHardFilter(place.price_note, c)) { dropped++; continue; }
    const miles = milesBetween(origin, place);
    if (!passesDistanceHardFilter(miles, c)) { dropped++; continue; }
    kept.push({ place, miles });
  }
  return { kept, droppedCount: dropped };
}

export function filterEvents(
  events: FeedEvent[],
  c: RecommendationConstraints,
  origin: { lat: number; lng: number } | null,
  now: Date,
): { kept: FilteredEvent[]; droppedCount: number } {
  let dropped = 0;
  const kept: FilteredEvent[] = [];
  for (const event of events) {
    if (event.status === "cancelled") { dropped++; continue; }
    if (!eventWithinTimeframe(event, c.timeframe, now)) { dropped++; continue; }
    if (!moodMatchesEvent(event, c.mood)) { dropped++; continue; }
    if (!passesIndoorHardFilter(event.is_outdoor, c)) { dropped++; continue; }
    if (!passesBudgetHardFilter(event.cost, c)) { dropped++; continue; }
    const miles = milesBetween(origin, event);
    if (!passesDistanceHardFilter(miles, c)) { dropped++; continue; }
    kept.push({ event, miles });
  }
  return { kept, droppedCount: dropped };
}
