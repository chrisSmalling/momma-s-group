import { describe, expect, it } from "vitest";
import type { FeedEvent, Place } from "@/types";
import { parseIntent } from "./intent";
import { filterEvents, filterPlaces, eventWithinTimeframe, eventMatchesTimeOfDay } from "./filter";
import { recommend } from "./recommend";
import { buildCacheKey } from "./cacheKey";
import type { PoppyProfile, RecommendationConstraints } from "./types";

// ---- Fixtures --------------------------------------------------------------

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "p1", name: "Test Playground", address: "1 Main St", lat: 28.2, lng: -82.4,
    metro_area: "pasco", hours: null, description: "desc", toddler_notes: "shady",
    price_note: "Free", age_min_months: 12, age_max_months: 60, website: null,
    booking_url: null, phone: null, source_url: null, last_verified_at: null,
    active: true, created_at: "2026-01-01", is_outdoor: true, food_allowed: null,
    restrooms: true, parking_notes: null, what_to_bring: [], typical_crowd_note: null,
    best_time_note: null, place_type: "playground", category_tags: ["playground", "outdoor"],
    is_enclosed: null, has_changing_table: null, nursing_friendly: null,
    stroller_accessible: true, food_onsite: null, quiet_or_sensory_friendly: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<FeedEvent> = {}): FeedEvent {
  return {
    id: "e1", title: "Storytime", description: "fun", venue: "Library", room_name: null,
    organizer: null, address: "2 Oak Ave", lat: 28.21, lng: -82.41, location_latitude: null,
    location_longitude: null, starts_at: "2026-08-27T15:00:00Z", ends_at: "2026-08-27T16:00:00Z",
    time_precision: "exact", time_unknown: false, cost: "Free", is_free: true, age_tags: [],
    age_min_months: 12, age_max_months: 48, age_band: null, is_outdoor: false, what_to_bring: [],
    registration_required: false, registration_url: null, source: "communico", source_id: null,
    source_url: null, content_status: "keep", geography_tier: "pasco", experience_type: "storytime_experience",
    weather_fit: "indoor", place_id: null, program_id: null, proposed_by_group: null,
    metro_area: "pasco", status: "published", last_verified_at: null, added_by: null,
    ...overrides,
  };
}

const baseProfile: PoppyProfile = {
  childAgeMonths: 24, childInterests: [], childActivityPreferences: [],
  preferredCategories: [], preferredPlaceTypes: [], indoorPreference: "either",
  maxDistanceMiles: null, familyBudgetNote: null, napStart: null, napEnd: null,
  homeLat: 28.2, homeLng: -82.4,
};

const anyConstraints: RecommendationConstraints = {
  mood: "all", indoor: "either", budget: "any", maxMiles: null, timeframe: "any", timeOfDay: "any", indoorExplicit: false,
};

const origin = { lat: 28.2, lng: -82.4 };
const NOW = new Date("2026-08-26T12:00:00Z"); // Wednesday

// ---- Intent parsing --------------------------------------------------------

describe("parseIntent", () => {
  it("detects an outdoor, active mood", () => {
    const c = parseIntent("somewhere my toddler can run around outside");
    expect(c.mood).toBe("outdoor");
    expect(c.indoor).toBe("outdoor");
    expect(c.indoorExplicit).toBe(true);
  });

  it("detects a free budget", () => {
    expect(parseIntent("something free today").budget).toBe("free");
  });

  it("parses an explicit mile ceiling", () => {
    expect(parseIntent("something within 10 miles").maxMiles).toBe(10);
  });

  it("converts a minutes phrase into a modest mile ceiling, not fake minutes", () => {
    const c = parseIntent("anywhere within 20 minutes");
    expect(c.maxMiles).toBeGreaterThan(0);
    expect(c.maxMiles).toBeLessThan(20);
  });

  it("detects weekend timeframe", () => {
    expect(parseIntent("something fun this weekend").timeframe).toBe("weekend");
  });

  it("treats 'closer' as tightening the previous distance", () => {
    const prev = parseIntent("something within 20 miles");
    const next = parseIntent("something closer", prev);
    expect(next.maxMiles!).toBeLessThan(prev.maxMiles!);
  });

  it("treats 'cheaper' as tightening the previous budget", () => {
    const next = parseIntent("anything cheaper", { budget: "budget" });
    expect(next.budget).toBe("free");
  });

  it("carries prior mood forward when the follow-up doesn't restate it", () => {
    const next = parseIntent("something closer", { mood: "water", indoor: "outdoor" });
    expect(next.mood).toBe("water");
  });
});

// ---- Hard filters ----------------------------------------------------------

describe("hard filters", () => {
  it("drops places beyond the distance ceiling", () => {
    const near = makePlace({ id: "near", lat: 28.2, lng: -82.4 });
    const far = makePlace({ id: "far", lat: 29.6, lng: -82.4 }); // ~97 mi north
    const c = { ...anyConstraints, maxMiles: 10 };
    const { kept } = filterPlaces([near, far], c, origin);
    expect(kept.map((k) => k.place.id)).toEqual(["near"]);
  });

  it("keeps items with unknown distance rather than dropping them", () => {
    const noCoords = makePlace({ id: "nocoord", lat: null, lng: null });
    const { kept } = filterPlaces([noCoords], { ...anyConstraints, maxMiles: 5 }, origin);
    expect(kept).toHaveLength(1);
  });

  it("applies indoor as a hard filter only when explicit", () => {
    const outdoor = makePlace({ id: "out", is_outdoor: true, category_tags: ["outdoor"] });
    const indoor = makePlace({ id: "in", is_outdoor: false, category_tags: ["indoor"] });
    const soft = filterPlaces([outdoor, indoor], { ...anyConstraints, indoor: "indoor", indoorExplicit: false }, origin);
    expect(soft.kept).toHaveLength(2); // soft preference doesn't filter
    const hard = filterPlaces([outdoor, indoor], { ...anyConstraints, mood: "indoor", indoor: "indoor", indoorExplicit: true }, origin);
    expect(hard.kept.map((k) => k.place.id)).toEqual(["in"]);
  });

  it("free budget keeps free + unknown cost, drops known-paid", () => {
    const free = makeEvent({ id: "free", cost: "Free", is_free: true });
    const paid = makeEvent({ id: "paid", cost: "$15", is_free: false });
    const unknown = makeEvent({ id: "unk", cost: null, is_free: false });
    const { kept } = filterEvents([free, paid, unknown], { ...anyConstraints, budget: "free" }, origin, NOW);
    expect(kept.map((k) => k.event.id).sort()).toEqual(["free", "unk"]);
  });

  it("filters events by mood via the real taxonomy", () => {
    const story = makeEvent({ id: "story", experience_type: "storytime_experience" });
    const animal = makeEvent({ id: "animal", experience_type: "animal" });
    const { kept } = filterEvents([story, animal], { ...anyConstraints, mood: "animals" }, origin, NOW);
    expect(kept.map((k) => k.event.id)).toEqual(["animal"]);
  });

  it("excludes events that already ended", () => {
    const past = makeEvent({ id: "past", starts_at: "2026-08-25T10:00:00Z", ends_at: "2026-08-25T11:00:00Z" });
    expect(eventWithinTimeframe(past, "any", NOW)).toBe(false);
  });

  it("respects a 'today' timeframe", () => {
    const today = makeEvent({ starts_at: "2026-08-26T18:00:00Z", ends_at: "2026-08-26T19:00:00Z" });
    const nextWeek = makeEvent({ starts_at: "2026-09-02T18:00:00Z", ends_at: "2026-09-02T19:00:00Z" });
    expect(eventWithinTimeframe(today, "today", NOW)).toBe(true);
    expect(eventWithinTimeframe(nextWeek, "today", NOW)).toBe(false);
  });

  it("enforces morning, afternoon, and evening windows as hard filters", () => {
    const morning = makeEvent({ id: "morning", starts_at: "2026-08-27T08:00:00Z", ends_at: "2026-08-27T09:00:00Z" });
    const afternoon = makeEvent({ id: "afternoon", starts_at: "2026-08-27T14:00:00Z", ends_at: "2026-08-27T15:00:00Z" });
    const evening = makeEvent({ id: "evening", starts_at: "2026-08-27T18:00:00Z", ends_at: "2026-08-27T19:00:00Z" });
    expect(eventMatchesTimeOfDay(morning, "morning")).toBe(true);
    expect(eventMatchesTimeOfDay(afternoon, "morning")).toBe(false);
    expect(eventMatchesTimeOfDay(afternoon, "afternoon")).toBe(true);
    expect(eventMatchesTimeOfDay(evening, "afternoon")).toBe(false);
    expect(eventMatchesTimeOfDay(evening, "evening")).toBe(true);
    const { kept } = filterEvents([morning, afternoon, evening], { ...anyConstraints, timeOfDay: "morning" }, origin, NOW);
    expect(kept.map((k) => k.event.id)).toEqual(["morning"]);
  });
});

// ---- Scoring / ranking -----------------------------------------------------

describe("recommend()", () => {
  it("returns an empty list when nothing matches the mood", () => {
    const place = makePlace({ category_tags: ["playground"] });
    const { candidates } = recommend({ places: [place], events: [] }, { ...anyConstraints, mood: "water" }, baseProfile, origin, null, NOW);
    expect(candidates).toHaveLength(0);
  });

  it("ranks a closer, age-fit, free place above a far, off-age one", () => {
    const good = makePlace({ id: "good", lat: 28.2, lng: -82.4, age_min_months: 12, age_max_months: 48, price_note: "Free" });
    const worse = makePlace({ id: "worse", lat: 28.6, lng: -82.9, age_min_months: 120, age_max_months: 180, price_note: "$40" });
    const { candidates } = recommend({ places: [good, worse], events: [] }, anyConstraints, baseProfile, origin, null, NOW);
    expect(candidates[0].id).toBe("good");
  });

  it("boosts places matching a stated child interest", () => {
    const animals = makePlace({ id: "zoo", category_tags: ["animals"], place_type: "zoo" });
    const plain = makePlace({ id: "plain", category_tags: ["playground"] });
    const profile = { ...baseProfile, childInterests: ["animals"] };
    const { candidates } = recommend({ places: [animals, plain], events: [] }, anyConstraints, profile, origin, null, NOW);
    expect(candidates[0].id).toBe("zoo");
  });

  it("explains a place recommendation using real age, interest, distance, and cost signals", () => {
    const place = makePlace({ category_tags: ["animals"], price_note: "Free", is_outdoor: true });
    const profile = { ...baseProfile, childInterests: ["animals"] };
    const { candidates } = recommend({ places: [place], events: [] }, anyConstraints, profile, origin, null, NOW);
    expect(candidates[0].reason).toContain("good fit for your 2-year-old");
    expect(candidates[0].reason).toContain("interest in animals");
    expect(candidates[0].reason).toContain("free");
    expect(candidates[0].reason).toContain("miles away");
  });

  it("explains an event recommendation using real age and interest signals", () => {
    const event = makeEvent({ experience_type: "storytime_experience", is_outdoor: false, is_free: true });
    const profile = { ...baseProfile, childInterests: ["books"] };
    const { candidates } = recommend({ places: [], events: [event] }, anyConstraints, profile, origin, null, NOW);
    expect(candidates[0].reason).toContain("great for your 2-year-old");
    expect(candidates[0].reason).toContain("books");
    expect(candidates[0].reason).toContain("free");
  });

  it("caps results at five", () => {
    const places = Array.from({ length: 9 }, (_, i) => makePlace({ id: `p${i}`, lat: 28.2 + i * 0.001, lng: -82.4 }));
    const { candidates } = recommend({ places, events: [] }, anyConstraints, baseProfile, origin, null, NOW);
    expect(candidates.length).toBe(5);
  });

  it("produces a deterministic order for identical inputs", () => {
    const places = [makePlace({ id: "a" }), makePlace({ id: "b", lat: 28.25 })];
    const first = recommend({ places, events: [] }, anyConstraints, baseProfile, origin, null, NOW).candidates.map((c) => c.id);
    const second = recommend({ places, events: [] }, anyConstraints, baseProfile, origin, null, NOW).candidates.map((c) => c.id);
    expect(first).toEqual(second);
  });

  it("never marks a place candidate free unless the cost says so", () => {
    const paid = makePlace({ price_note: "$12" });
    const { candidates } = recommend({ places: [paid], events: [] }, anyConstraints, baseProfile, origin, null, NOW);
    expect(candidates[0].isFree).toBe(false);
  });
});

// ---- Cache key -------------------------------------------------------------

describe("buildCacheKey", () => {
  it("is stable for identical inputs", () => {
    const a = buildCacheKey("user-1", anyConstraints, baseProfile, origin, NOW);
    const b = buildCacheKey("user-1", anyConstraints, baseProfile, origin, NOW);
    expect(a).toBe(b);
  });

  it("differs across users (no cross-user cache sharing)", () => {
    const a = buildCacheKey("user-1", anyConstraints, baseProfile, origin, NOW);
    const b = buildCacheKey("user-2", anyConstraints, baseProfile, origin, NOW);
    expect(a).not.toBe(b);
  });

  it("changes when constraints change", () => {
    const a = buildCacheKey("user-1", anyConstraints, baseProfile, origin, NOW);
    const b = buildCacheKey("user-1", { ...anyConstraints, mood: "water" }, baseProfile, origin, NOW);
    expect(a).not.toBe(b);
  });

  it("changes across inventory days", () => {
    const a = buildCacheKey("user-1", anyConstraints, baseProfile, origin, NOW);
    const b = buildCacheKey("user-1", anyConstraints, baseProfile, origin, new Date("2026-08-27T12:00:00Z"));
    expect(a).not.toBe(b);
  });
});
