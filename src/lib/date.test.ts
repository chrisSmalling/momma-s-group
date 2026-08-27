import { describe, expect, it } from "vitest";
import { etYMD, isInEtMonth, isOnEtDay } from "./date";

// August is month0 = 7 (0-based, matches Date's getMonth()).
const AUGUST = 7;
const SEPTEMBER = 8;

describe("etYMD (calendar off-by-one regression)", () => {
  it("resolves a mid-month ET timestamp to its own calendar date", () => {
    expect(etYMD("2026-08-30T15:00:00-04:00")).toEqual({ y: 2026, m: 8, d: 30 });
  });

  it("keeps a late-night ET timestamp on the same day, not the next", () => {
    // 11:30 PM ET Aug 31 — a naive UTC read would land this on Sep 1.
    expect(etYMD("2026-08-31T23:30:00-04:00")).toEqual({ y: 2026, m: 8, d: 31 });
  });

  it("keeps an early-morning ET timestamp on the same day, not the previous", () => {
    expect(etYMD("2026-09-01T00:30:00-04:00")).toEqual({ y: 2026, m: 9, d: 1 });
  });

  it("resolves a UTC-midnight instant to the prior ET calendar day", () => {
    // 2026-08-01T00:00:00Z is 2026-07-31 8:00 PM ET.
    expect(etYMD("2026-08-01T00:00:00Z")).toEqual({ y: 2026, m: 7, d: 31 });
  });
});

describe("isInEtMonth", () => {
  it("matches an event to its ET month, not the UTC month", () => {
    // Same UTC-midnight instant as above: UTC says August, ET says July.
    expect(isInEtMonth("2026-08-01T00:00:00Z", 2026, AUGUST)).toBe(false);
    expect(isInEtMonth("2026-08-01T00:00:00Z", 2026, AUGUST - 1)).toBe(true);
  });

  it("matches a normal mid-month event to its actual month", () => {
    expect(isInEtMonth("2026-08-30T15:00:00-04:00", 2026, AUGUST)).toBe(true);
    expect(isInEtMonth("2026-08-30T15:00:00-04:00", 2026, SEPTEMBER)).toBe(false);
  });
});

describe("isOnEtDay (day-selection narrowing)", () => {
  it("places an event on its ET day, not a UTC-shifted one", () => {
    expect(isOnEtDay("2026-08-01T00:00:00Z", 2026, AUGUST - 1, 31)).toBe(true);
    expect(isOnEtDay("2026-08-01T00:00:00Z", 2026, AUGUST, 1)).toBe(false);
  });

  it("distinguishes adjacent days across a month boundary", () => {
    expect(isOnEtDay("2026-08-31T23:30:00-04:00", 2026, AUGUST, 31)).toBe(true);
    expect(isOnEtDay("2026-09-01T00:30:00-04:00", 2026, SEPTEMBER, 1)).toBe(true);
    expect(isOnEtDay("2026-09-01T00:30:00-04:00", 2026, AUGUST, 31)).toBe(false);
  });
});
