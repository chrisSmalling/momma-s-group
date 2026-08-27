import { describe, expect, it } from "vitest";
import { buildGroundedWhy, getFreshnessState, getTrustSummary } from "./trust";
import type { RecommendationCandidate } from "./types";

const base: RecommendationCandidate = {
  type: "event", id: "1", title: "Storytime", description: "A storytime", address: "123 Main St",
  distanceMiles: 4.2, driveMinutes: 10, distanceLabel: "~4.2 mi away", startsAt: "2026-08-27T10:00:00-04:00",
  endsAt: null, price: "$5", isFree: false, isOutdoor: false, ageMinMonths: 24, ageMaxMonths: 60,
  goodAgeFit: true, reason: "Fits", href: "/events/1", lastVerifiedAt: "2026-08-26T12:00:00-04:00", score: 10,
  whatToBring: [], strollerAccessible: null, changingTable: null, nursingFriendly: null, parkingNotes: null,
  typicalCrowdNote: null, bestTimeNote: null,
};

describe("recommendation trust", () => {
  it("distinguishes verified, recent, stale, and unknown", () => {
    const now = new Date("2026-08-26T16:00:00Z");
    expect(getFreshnessState("2026-08-26T12:00:00Z", now)).toBe("verified");
    expect(getFreshnessState("2026-08-24T12:00:00Z", now)).toBe("recent");
    expect(getFreshnessState("2026-08-10T12:00:00Z", now)).toBe("stale");
    expect(getFreshnessState(null, now)).toBe("unknown");
  });

  it("does not turn missing practical facts into positive claims", () => {
    const summary = getTrustSummary(base, new Date("2026-08-26T16:00:00Z"));
    expect(summary.practicalFactCount).toBe(0);
    expect(summary.hasCommunityTips).toBe(false);
  });

  it("builds why text only from candidate facts", () => {
    expect(buildGroundedWhy(base)).toEqual([
      "it fits the child age range", "it is 4.2 mi away", "it is indoors",
    ]);
  });

  it("includes only explicit facts", () => {
    const candidate = { ...base, goodAgeFit: false, distanceLabel: null, isFree: true, isOutdoor: null };
    expect(buildGroundedWhy(candidate)).toEqual(["it is free"]);
  });
});
