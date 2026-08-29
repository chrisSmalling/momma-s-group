import { describe, expect, it } from "vitest";
import { toPlaceSearchCandidate } from "./placeSearchCandidate";
import type { PlaceSearchResult } from "@/lib/places/search";
import type { Place } from "@/types";

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "p1", name: "Test Gymnastics", address: null, lat: 28.1, lng: -82.4,
    metro_area: "tampa_bay", hours: null, description: "raw scraped nav text about gymnastics",
    toddler_notes: null, price_note: null, age_min_months: null, age_max_months: null,
    website: null, booking_url: null, phone: null, source_url: null, last_verified_at: null,
    active: true, created_at: "2026-01-01T00:00:00Z", is_outdoor: false, food_allowed: null,
    restrooms: null, parking_notes: null, what_to_bring: [], typical_crowd_note: null,
    best_time_note: null, place_type: "indoor", category_tags: [],
    is_enclosed: null, has_changing_table: null, nursing_friendly: null,
    stroller_accessible: null, food_onsite: null, quiet_or_sensory_friendly: null,
    ...overrides,
  };
}

function result(overrides: Partial<PlaceSearchResult> = {}): PlaceSearchResult {
  return { place: place(), miles: null, driveMinutes: null, goodAgeFit: false, ...overrides };
}

describe("toPlaceSearchCandidate", () => {
  it("never surfaces the raw scraped description, only curated toddler_notes", () => {
    const candidate = toPlaceSearchCandidate(result({ place: place({ toddler_notes: null }) }), null, 0);
    // description is null on the row -> stays null, never falls back to the messy scraped text.
    expect(candidate.description).toBeNull();
  });

  it("shows unknown (null) cost/hours rather than a guessed value when the row doesn't know", () => {
    const candidate = toPlaceSearchCandidate(result({ place: place({ price_note: null }) }), null, 0);
    expect(candidate.price).toBeNull();
    expect(candidate.isFree).toBe(false);
  });

  it("carries a real known price through untouched", () => {
    const candidate = toPlaceSearchCandidate(result({ place: place({ price_note: "Free" }) }), null, 0);
    expect(candidate.price).toBe("Free");
    expect(candidate.isFree).toBe(true);
  });

  it("links to the propose flow for the place", () => {
    const candidate = toPlaceSearchCandidate(result({ place: place({ id: "abc" }) }), null, 0);
    expect(candidate.href).toBe("/places/abc/propose");
  });
});
