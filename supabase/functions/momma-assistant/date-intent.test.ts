import { describe, expect, it } from "vitest";
import { deterministicWindow, zoned } from "./date-intent";

describe("Poppy deterministic date intent", () => {
  const wed = new Date("2026-08-26T18:00:00-04:00");

  it("resolves today to local midnight through next local midnight", () => {
    const w = deterministicWindow("find something today", wed)!;
    expect(w.start_at).toBe("2026-08-26T04:00:00.000Z");
    expect(w.end_at).toBe("2026-08-27T04:00:00.000Z");
  });

  it("resolves tomorrow", () => {
    const w = deterministicWindow("tomorrow", wed)!;
    expect(w.start_at).toBe("2026-08-27T04:00:00.000Z");
    expect(w.end_at).toBe("2026-08-28T04:00:00.000Z");
  });

  it("resolves this weekend from Wednesday as Saturday through Monday midnight", () => {
    const w = deterministicWindow("this weekend", wed)!;
    expect(w.start_at).toBe("2026-08-29T04:00:00.000Z");
    expect(w.end_at).toBe("2026-08-31T04:00:00.000Z");
  });

  it("resolves this weekend on Sunday as the weekend currently in progress", () => {
    const sun = new Date("2026-08-30T12:00:00-04:00");
    const w = deterministicWindow("this weekend", sun)!;
    expect(w.start_at).toBe("2026-08-29T04:00:00.000Z");
    expect(w.end_at).toBe("2026-08-31T04:00:00.000Z");
  });

  it("resolves the next Saturday", () => {
    const w = deterministicWindow("next Saturday", wed)!;
    expect(w.start_at).toBe("2026-09-05T04:00:00.000Z");
    expect(w.end_at).toBe("2026-09-06T04:00:00.000Z");
  });

  it("does not hard-code a full-day window for explicit time-of-day language", () => {
    expect(deterministicWindow("Saturday morning", wed)).toBeNull();
    expect(deterministicWindow("Saturday afternoon", wed)).toBeNull();
    expect(deterministicWindow("Saturday evening", wed)).toBeNull();
  });

  it("handles the fall DST boundary using the named Florida timezone", () => {
    expect(zoned(2026, 11, 1, 0, 0)).toBe("2026-11-01T04:00:00.000Z");
    expect(zoned(2026, 11, 2, 0, 0)).toBe("2026-11-02T05:00:00.000Z");
  });

  it("does not invent a window for an unrelated request", () => {
    expect(deterministicWindow("something fun for my toddler", wed)).toBeNull();
  });
});
