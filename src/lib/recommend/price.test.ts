import { describe, expect, it } from "vitest";
import type { Place } from "@/types";
import { parseIntent } from "./intent";
import { filterEvents, filterPlaces } from "./filter";
import type { PoppyCandidate, RecommendationConstraints } from "./types";

const base: RecommendationConstraints = {
  mood: "all", indoor: "either", budget: "any", maxMiles: null,
  maxPriceDollars: null, timeframe: "any", timeOfDay: "any", indoorExplicit: false,
};
const origin = { lat: 28.2, lng: -82.4 };
const event = (cost: string | null, isFree = false): PoppyCandidate => ({
  kind: "event", id: crypto.randomUUID(), title: "Test", description: null, venue: "Venue", room_name: null,
  organizer: null, address: "1 Main St", lat: 28.2, lng: -82.4, location_latitude: null, location_longitude: null,
  starts_at: "2026-08-27T14:00:00-04:00", ends_at: "2026-08-27T15:00:00-04:00", time_precision: "exact", time_unknown: false,
  cost, is_free: isFree, age_tags: [], age_min_months: null, age_max_months: null, age_band: null, is_outdoor: false,
  what_to_bring: [], registration_required: false, registration_url: null, source: "test", source_id: null, source_url: null,
  content_status: "keep", geography_tier: "pasco", experience_type: "general", weather_fit: "indoor", place_id: null,
  program_id: null, proposed_by_group: null, metro_area: "pasco", status: "published", last_verified_at: null, added_by: null,
  hours: null, season_start: null, season_end: null,
});

describe("explicit price constraints", () => {
  it("parses dollar ceilings", () => {
    expect(parseIntent("something under $12").maxPriceDollars).toBe(12);
    expect(parseIntent("nothing more than 20 dollars").maxPriceDollars).toBe(20);
  });

  it("filters known prices above the ceiling while retaining unknown prices", () => {
    const { kept } = filterEvents([event("$8"), event("$15"), event(null), event("$10-$18"), event("Free", true)], { ...base, maxPriceDollars: 12 }, origin, new Date("2026-08-26T12:00:00Z"));
    expect(kept.map(({ event: e }) => e.cost)).toEqual(["$8", null, "Free"]);
  });

  it("treats multi-price listings conservatively using the highest listed price", () => {
    const { kept } = filterEvents([event("$5-$9"), event("$5-$15")], { ...base, maxPriceDollars: 10 }, origin, new Date("2026-08-26T12:00:00Z"));
    expect(kept.map(({ event: e }) => e.cost)).toEqual(["$5-$9"]);
  });

  it("applies the same price ceiling to places", () => {
    const makePlace = (price_note: string | null): Place => ({
      id: crypto.randomUUID(), name: "Place", address: "1 Main St", lat: 28.2, lng: -82.4, metro_area: "pasco", hours: null,
      description: null, toddler_notes: null, price_note, age_min_months: null, age_max_months: null, website: null,
      booking_url: null, phone: null, source_url: null, last_verified_at: null, active: true, created_at: "2026-01-01",
      is_outdoor: false, food_allowed: null, restrooms: null, parking_notes: null, what_to_bring: [], typical_crowd_note: null,
      best_time_note: null, place_type: "museum", category_tags: ["indoor"], is_enclosed: null, has_changing_table: null,
      nursing_friendly: null, stroller_accessible: null, food_onsite: null, quiet_or_sensory_friendly: null,
    });
    const { kept } = filterPlaces([makePlace("$10"), makePlace("$25"), makePlace(null)], { ...base, maxPriceDollars: 15 }, origin);
    expect(kept.map(({ place }) => place.price_note)).toEqual(["$10", null]);
  });
});
