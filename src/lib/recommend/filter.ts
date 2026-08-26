// Deterministic hard filters. Applied BEFORE scoring/ranking and never overridden by model output.
import { isFreeCost } from "@/lib/cost";
import { distanceKm } from "@/lib/distance";
import type { FeedEvent, Place } from "@/types";
import type { Mood, RecommendationConstraints, Timeframe, TimeOfDay } from "./types";

const KM_PER_MILE = 1.609344;
const APP_TIME_ZONE = "America/New_York";

export function milesBetween(origin: { lat: number; lng: number } | null, point: { lat: number | null; lng: number | null }): number | null {
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

export function eventWithinTimeframe(e: FeedEvent, timeframe: Timeframe, now: Date): boolean {
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : start;
  if (end.getTime() < now.getTime()) return false;
  if (timeframe === "any") return true;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  if (timeframe === "today") return start.getTime() < startOfToday.getTime() + dayMs;
  if (timeframe === "tomorrow") {
    const startOfTomorrow = new Date(startOfToday.getTime() + dayMs);
    return start.getTime() >= startOfTomorrow.getTime() && start.getTime() < startOfTomorrow.getTime() + dayMs;
  }
  const day = now.getDay();
  const daysUntilSat = (6 - day + 7) % 7;
  const satStart = new Date(startOfToday.getTime() + daysUntilSat * dayMs);
  const monStart = new Date(satStart.getTime() + 2 * dayMs);
  const rangeStart = day === 0 ? startOfToday : satStart;
  return start.getTime() >= rangeStart.getTime() && start.getTime() < monStart.getTime();
}

function easternMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
}

export function eventMatchesTimeOfDay(e: FeedEvent, timeOfDay: TimeOfDay): boolean {
  if (timeOfDay === "any") return true;
  const startMinutes = easternMinutes(new Date(e.starts_at));
  const endMinutes = easternMinutes(new Date(e.ends_at ?? e.starts_at));
  const windowStart = timeOfDay === "morning" ? 360 : timeOfDay === "afternoon" ? 720 : 1020;
  const windowEnd = timeOfDay === "morning" ? 720 : timeOfDay === "afternoon" ? 1020 : 1260;
  if (endMinutes < startMinutes) return startMinutes < windowEnd || endMinutes > windowStart;
  return startMinutes < windowEnd && endMinutes > windowStart;
}

function passesIndoorHardFilter(isOutdoor: boolean | null, c: RecommendationConstraints): boolean {
  if (!c.indoorExplicit || c.indoor === "either") return true;
  if (isOutdoor == null) return true;
  return c.indoor === "outdoor" ? isOutdoor : !isOutdoor;
}

function parseMaxPrice(cost: string | null): number | null {
  if (!cost?.trim()) return null;
  if (isFreeCost(cost)) return 0;
  const values = [...cost.matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g)].map((m) => Number(m[1])).filter(Number.isFinite);
  return values.length ? Math.max(...values) : null;
}

function passesBudgetHardFilter(cost: string | null, c: RecommendationConstraints): boolean {
  if (c.budget === "free" && isFreeCost(cost)) return true;
  if (c.budget === "free" && parseMaxPrice(cost) !== null) return false;
  if (c.budget === "free") return true;
  if (c.maxPriceDollars == null) return true;
  const price = parseMaxPrice(cost);
  return price == null || price <= c.maxPriceDollars;
}

function passesDistanceHardFilter(miles: number | null, c: RecommendationConstraints): boolean {
  return c.maxMiles == null || miles == null || miles <= c.maxMiles;
}

export interface FilteredPlace { place: Place; miles: number | null; }
export interface FilteredEvent { event: FeedEvent; miles: number | null; }

export function filterPlaces(places: Place[], c: RecommendationConstraints, origin: { lat: number; lng: number } | null): { kept: FilteredPlace[]; droppedCount: number } {
  let dropped = 0;
  const kept: FilteredPlace[] = [];
  for (const place of places) {
    if (!place.active || !moodMatchesPlace(place, c.mood) || !passesIndoorHardFilter(place.is_outdoor, c) || !passesBudgetHardFilter(place.price_note, c)) { dropped++; continue; }
    const miles = milesBetween(origin, place);
    if (!passesDistanceHardFilter(miles, c)) { dropped++; continue; }
    kept.push({ place, miles });
  }
  return { kept, droppedCount: dropped };
}

export function filterEvents(events: FeedEvent[], c: RecommendationConstraints, origin: { lat: number; lng: number } | null, now: Date): { kept: FilteredEvent[]; droppedCount: number } {
  let dropped = 0;
  const kept: FilteredEvent[] = [];
  for (const event of events) {
    if (event.status === "cancelled" || !eventWithinTimeframe(event, c.timeframe, now) || !eventMatchesTimeOfDay(event, c.timeOfDay) || !moodMatchesEvent(event, c.mood) || !passesIndoorHardFilter(event.is_outdoor, c) || !passesBudgetHardFilter(event.cost, c)) { dropped++; continue; }
    const miles = milesBetween(origin, event);
    if (!passesDistanceHardFilter(miles, c)) { dropped++; continue; }
    kept.push({ event, miles });
  }
  return { kept, droppedCount: dropped };
}
