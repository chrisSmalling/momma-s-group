import { describe, expect, it } from "vitest";
import { parseIntent } from "./intent";

describe("parseIntent", () => {
  it("keeps local-first defaults", () => {
    expect(parseIntent("something fun")).toMatchObject({
      mood: "all",
      indoor: "either",
      budget: "any",
      maxMiles: 20,
      timeframe: "any",
      timeOfDay: "any",
      indoorExplicit: false,
    });
  });

  it("recognizes explicit indoor, budget, distance, and timeframe constraints", () => {
    expect(parseIntent("Find something indoors under $20 within 10 miles today")).toMatchObject({
      mood: "indoor",
      indoor: "indoor",
      indoorExplicit: true,
      budget: "budget",
      maxMiles: 10,
      timeframe: "today",
      timeOfDay: "any",
    });
  });

  it("recognizes near-me requests as a close local radius", () => {
    expect(parseIntent("What's near me right now?")).toMatchObject({ maxMiles: 8, timeframe: "today", timeOfDay: "any" });
  });

  it("recognizes morning, afternoon, and evening windows", () => {
    expect(parseIntent("something fun this morning")).toMatchObject({ timeframe: "today", timeOfDay: "morning" });
    expect(parseIntent("something fun after lunch")).toMatchObject({ timeframe: "any", timeOfDay: "afternoon" });
    expect(parseIntent("something fun tonight")).toMatchObject({ timeframe: "today", timeOfDay: "evening" });
  });

  it("preserves prior constraints for follow-up requests", () => {
    expect(parseIntent("something closer", {
      mood: "outdoor",
      indoor: "outdoor",
      budget: "any",
      maxMiles: 20,
      timeframe: "weekend",
      timeOfDay: "morning",
      indoorExplicit: true,
    })).toMatchObject({
      mood: "outdoor",
      indoor: "outdoor",
      timeframe: "weekend",
      timeOfDay: "morning",
      maxMiles: 12,
      indoorExplicit: true,
    });
  });

  it("tightens cheaper follow-ups", () => {
    expect(parseIntent("anything cheaper", { budget: "any", maxMiles: 20 })).toMatchObject({
      budget: "budget",
      maxMiles: 20,
    });
  });

  it("expands only for explicit farther requests", () => {
    expect(parseIntent("show me more options farther away", { maxMiles: 20 })).toMatchObject({ maxMiles: 35 });
  });

  it("keeps nearby requests from accidentally expanding the search", () => {
    expect(parseIntent("anything nearby").maxMiles).toBe(8);
  });
});
