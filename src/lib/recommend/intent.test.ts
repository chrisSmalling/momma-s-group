import { describe, expect, it } from "vitest";
import { parseIntent } from "./intent";

describe("parseIntent", () => {
  it("keeps local-first defaults", () => {
    expect(parseIntent("something fun")).toMatchObject({
      mood: "all", indoor: "either", budget: "any", maxMiles: 20, maxPriceDollars: null,
      timeframe: "any", timeOfDay: "any", indoorExplicit: false,
    });
  });

  it("recognizes explicit indoor, budget, distance, price, and timeframe constraints", () => {
    expect(parseIntent("Find something indoors under $20 within 10 miles today")).toMatchObject({
      mood: "indoor", indoor: "indoor", indoorExplicit: true, budget: "budget",
      maxMiles: 10, maxPriceDollars: 20, timeframe: "today", timeOfDay: "any",
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
      mood: "outdoor", indoor: "outdoor", budget: "any", maxMiles: 20, maxPriceDollars: 30,
      timeframe: "weekend", timeOfDay: "morning", indoorExplicit: true,
    })).toMatchObject({ mood: "outdoor", indoor: "outdoor", timeframe: "weekend", timeOfDay: "morning", maxMiles: 12, maxPriceDollars: 30, indoorExplicit: true });
  });

  it("tightens cheaper follow-ups", () => {
    expect(parseIntent("anything cheaper", { budget: "budget", maxMiles: 20, maxPriceDollars: 20 })).toMatchObject({ budget: "free", maxMiles: 20, maxPriceDollars: 14 });
  });

  it("parses common price ceiling language", () => {
    expect(parseIntent("keep it below $15").maxPriceDollars).toBe(15);
    expect(parseIntent("no more than 25 dollars").maxPriceDollars).toBe(25);
    expect(parseIntent("up to $10").maxPriceDollars).toBe(10);
  });

  it("expands only for explicit farther requests", () => {
    expect(parseIntent("show me more options farther away", { maxMiles: 20 })).toMatchObject({ maxMiles: 35 });
  });

  it("keeps nearby requests from accidentally expanding the search", () => {
    expect(parseIntent("anything nearby").maxMiles).toBe(8);
  });
});
