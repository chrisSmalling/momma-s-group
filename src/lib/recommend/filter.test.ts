import { describe, expect, it } from "vitest";
import { eventWithinTimeframe, isPlaceInSeason, placeOpenness } from "./filter";
import type { PoppyCandidate } from "./types";

// Phase A (honest unified candidate model): places have no event-time, so
// their eligibility is season_start/season_end + hours instead of a shared
// starts_at filter. These tests cover the acceptance criteria from the
// handoff: no synthetic time, seasonality honored, hours honesty (an
// unknown fact is never read as either open or closed).

function place(overrides: Partial<PoppyCandidate> = {}): PoppyCandidate {
  return {
    kind: "place", id: "p1", title: "Test Place", description: null, venue: "Test Place", room_name: null,
    organizer: null, address: "1 Main St", lat: 28.2, lng: -82.4, location_latitude: null, location_longitude: null,
    starts_at: null, ends_at: null, time_precision: "unknown", time_unknown: true, cost: "Free", is_free: true,
    age_tags: [], age_min_months: null, age_max_months: null, age_band: null, is_outdoor: true, what_to_bring: [],
    registration_required: null, registration_url: null, source: "place", source_id: null, source_url: null,
    content_status: null, geography_tier: "verified", experience_type: null, weather_fit: "outdoor",
    place_id: "p1", program_id: null, proposed_by_group: null, metro_area: "pasco", status: "published",
    last_verified_at: null, added_by: null, hours: null, season_start: null, season_end: null,
    ...overrides,
  };
}

describe("isPlaceInSeason", () => {
  const NOW = new Date("2026-08-27T12:00:00Z");

  it("treats a place with no season fields as always available", () => {
    expect(isPlaceInSeason(null, null, NOW)).toBe(true);
  });

  it("excludes a place whose season has already ended", () => {
    expect(isPlaceInSeason(null, "2026-07-01", NOW)).toBe(false);
  });

  it("excludes a place whose season hasn't started yet", () => {
    expect(isPlaceInSeason("2026-12-01", null, NOW)).toBe(false);
  });

  it("includes a place whose season covers today", () => {
    expect(isPlaceInSeason("2026-08-01", "2026-09-30", NOW)).toBe(true);
  });
});

describe("placeOpenness", () => {
  // 2026-08-27 12:00 ET is a Thursday.
  const THURSDAY_NOON_ET = new Date("2026-08-27T16:00:00Z");

  it("is unknown when there's no hours object at all", () => {
    expect(placeOpenness(null, THURSDAY_NOON_ET)).toBe("unknown");
  });

  it("is open when the current time falls inside today's parsed range", () => {
    expect(placeOpenness({ thu: "10:00-21:00" }, THURSDAY_NOON_ET)).toBe("open");
  });

  it("is closed when the current time falls outside today's parsed range", () => {
    expect(placeOpenness({ thu: "18:00-21:00" }, THURSDAY_NOON_ET)).toBe("closed");
  });

  it("is closed when today's day is absent from a known hours object", () => {
    expect(placeOpenness({ mon: "10:00-21:00" }, THURSDAY_NOON_ET)).toBe("closed");
  });

  it("is closed on an explicit 'closed' value", () => {
    expect(placeOpenness({ thu: "closed" }, THURSDAY_NOON_ET)).toBe("closed");
  });

  it("is unknown, not closed, when today's value fails to parse", () => {
    expect(placeOpenness({ thu: "call for hours" }, THURSDAY_NOON_ET)).toBe("unknown");
  });
});

describe("eventWithinTimeframe (per-kind eligibility)", () => {
  const TODAY = new Date("2026-08-27T16:00:00Z"); // Thursday noon ET

  it("excludes an out-of-season place regardless of timeframe", () => {
    const outOfSeason = place({ season_end: "2026-06-01" });
    expect(eventWithinTimeframe(outOfSeason, "any", TODAY)).toBe(false);
    expect(eventWithinTimeframe(outOfSeason, "today", TODAY)).toBe(false);
  });

  it("excludes a place that's genuinely closed right now only for a 'today' request", () => {
    const closedNow = place({ hours: { thu: "18:00-21:00" } });
    expect(eventWithinTimeframe(closedNow, "today", TODAY)).toBe(false);
    expect(eventWithinTimeframe(closedNow, "any", TODAY)).toBe(true);
    expect(eventWithinTimeframe(closedNow, "weekend", TODAY)).toBe(true);
  });

  it("never excludes a place for unknown hours", () => {
    const unknownHours = place({ hours: null });
    expect(eventWithinTimeframe(unknownHours, "today", TODAY)).toBe(true);
  });

  it("includes an in-season, open-now place for a 'today' request", () => {
    const openNow = place({ hours: { thu: "10:00-21:00" }, season_start: "2026-08-01", season_end: "2026-09-30" });
    expect(eventWithinTimeframe(openNow, "today", TODAY)).toBe(true);
  });

  it("excludes an event with no starts_at rather than crashing", () => {
    const malformed = { ...place({ kind: "event" }), starts_at: null };
    expect(eventWithinTimeframe(malformed, "any", TODAY)).toBe(false);
  });
});
