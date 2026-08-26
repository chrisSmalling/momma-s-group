import { describe, expect, it } from "vitest";
import { deterministicWindow, zoned } from "./date-intent";

describe("Poppy deterministic date intent", () => {
  const now = new Date("2026-08-26T18:00:00-04:00"); // Wednesday in Florida

  it("resolves today to local midnight through next local midnight", () => {
    const w = deterministicWindow("find something today", now)!;
    expect(w.start_at).toBe("2026-08-26T04:00:00.000Z");
    expect(w.end_at).toBe("2026-08-27T04:00:00.000Z");
  });

  it("resolves tomorrow", () => {
    const w = deterministicWindow("tomorrow", now)!;
    expect(w.start_at).toBe("2026-08-27T04:00:00.000Z");
    expect(w.end_at).toBe("2026-08-28T04:00:00.000Z");
  });

  it("resolves this weekend as Saturday through Monday midnight", () => {
    const w = deterministicWindow("this weekend", now)!;
    expect(w.start_at).toBe("2026-08-29T04:00:00.000Z");
    expect(w.end_at).toBe("2026-08-31T04:00:00.000Z");
  });

  it("resolves the next Saturday", () => {
    const w = deterministicWindow("next Saturday", now)!;
    expect(w.start_at).toBe("2026-09-05T04:00:00.000Z");
    expect(w.end_at).toBe("2026-09-06T04:00:00.000Z");
  });

  it("handles the fall DST boundary using the named Florida timezone", () => {
    expect(zoned(2026, 11, 1, 0, 0)).toBe("2026-11-01T04:00:00.000Z");
    expect(zoned(2026, 11, 2, 0, 0)).toBe("2026-11-02T05:00:00.000Z");
  });

  it("does not invent a window for an unrelated request", () => {
    expect(deterministicWindow("something fun for my toddler", now)).toBeNull();
  });
});
