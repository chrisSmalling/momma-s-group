import { describe, expect, it } from "vitest";
import { buildPlaceSearchResponseText } from "./placeSearchText";
import type { RecommendationCandidate } from "./types";

function candidate(overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    type: "place", id: "p1", title: "Test Place", description: null, address: null,
    distanceMiles: null, driveMinutes: null, distanceLabel: null, startsAt: null, endsAt: null,
    price: null, isFree: false, isOutdoor: false, ageMinMonths: null, ageMaxMonths: null,
    goodAgeFit: false, reason: "", href: "/places/p1/propose", lastVerifiedAt: null, score: 0,
    whatToBring: [], strollerAccessible: null, changingTable: null, nursingFriendly: null,
    parkingNotes: null, typicalCrowdNote: null, bestTimeNote: null, registrationRequired: false,
    ...overrides,
  };
}

describe("buildPlaceSearchResponseText", () => {
  it("gives an honest miss for zero matches, never inventing a result", () => {
    const text = buildPlaceSearchResponseText("rock climbing", [], null);
    expect(text).toContain("don't have any rock climbing places on file yet");
    expect(text).not.toMatch(/found/i);
  });

  it("states the real count for matches", () => {
    const text = buildPlaceSearchResponseText("gymnastics", [candidate(), candidate({ id: "p2" })], null);
    expect(text).toContain("2 places for gymnastics");
  });

  it("uses singular phrasing for exactly one match", () => {
    const text = buildPlaceSearchResponseText("gymnastics", [candidate()], "Vivian");
    expect(text).toContain("1 place for gymnastics for Vivian");
  });

  it("only claims the 45-minute window when every result actually has a drive time", () => {
    const withDriveTime = buildPlaceSearchResponseText("gymnastics", [candidate({ driveMinutes: 20 })], null);
    expect(withDriveTime).toContain("within 45 minutes");

    const withoutDriveTime = buildPlaceSearchResponseText("gymnastics", [candidate({ driveMinutes: null })], null);
    expect(withoutDriveTime).not.toContain("within 45 minutes");
  });
});
