import { describe, expect, it } from "vitest";
import { exposurePenalty, nextExposureState, MAX_EXPOSURE_PENALTY } from "./exposure";

describe("exposure penalty (Today place rotation)", () => {
  it("applies no penalty to a place never shown before", () => {
    expect(exposurePenalty(null, "2026-08-27")).toBe(0);
  });

  it("applies a mild penalty the day after a single showing", () => {
    const state = { lastShownAt: "2026-08-26", consecutiveDays: 1 };
    expect(exposurePenalty(state, "2026-08-27")).toBe(10);
  });

  it("escalates penalty for each consecutive day already shown", () => {
    expect(exposurePenalty({ lastShownAt: "2026-08-26", consecutiveDays: 3 }, "2026-08-27")).toBe(30);
    expect(exposurePenalty({ lastShownAt: "2026-08-26", consecutiveDays: 1 }, "2026-08-27")).toBe(10);
  });

  it("caps the penalty so relevance can still win", () => {
    expect(exposurePenalty({ lastShownAt: "2026-08-26", consecutiveDays: 10 }, "2026-08-27")).toBe(MAX_EXPOSURE_PENALTY);
  });

  it("fully resets once rotated out for two or more days", () => {
    expect(exposurePenalty({ lastShownAt: "2026-08-20", consecutiveDays: 5 }, "2026-08-27")).toBe(0);
  });

  it("is stable across same-day reloads (doesn't shift ranking mid-day)", () => {
    const beforeToday = { lastShownAt: "2026-08-26", consecutiveDays: 2 };
    const afterFirstLoad = nextExposureState(beforeToday, "2026-08-27");
    expect(exposurePenalty(beforeToday, "2026-08-27")).toBe(exposurePenalty(afterFirstLoad, "2026-08-27"));
  });

  it("increments the streak on a new consecutive day and resets after a gap", () => {
    expect(nextExposureState({ lastShownAt: "2026-08-26", consecutiveDays: 2 }, "2026-08-27")).toEqual({ lastShownAt: "2026-08-27", consecutiveDays: 3 });
    expect(nextExposureState({ lastShownAt: "2026-08-20", consecutiveDays: 5 }, "2026-08-27")).toEqual({ lastShownAt: "2026-08-27", consecutiveDays: 1 });
    expect(nextExposureState(null, "2026-08-27")).toEqual({ lastShownAt: "2026-08-27", consecutiveDays: 1 });
  });

  it("is idempotent when recorded twice on the same day", () => {
    const first = nextExposureState({ lastShownAt: "2026-08-26", consecutiveDays: 2 }, "2026-08-27");
    const second = nextExposureState(first, "2026-08-27");
    expect(second).toEqual(first);
  });
});
