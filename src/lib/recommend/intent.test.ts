import { describe, expect, it } from "vitest";
import { parseIntent } from "./intent";

describe("Poppy intent distance constraints", () => {
  it("treats close as a hard local radius", () => {
    expect(parseIntent("something close").maxMiles).toBe(8);
  });

  it("uses the local service radius when no distance is stated", () => {
    expect(parseIntent("what can we do today?").maxMiles).toBe(20);
  });

  it("keeps nearby requests local rather than expanding the search", () => {
    expect(parseIntent("anything nearby").maxMiles).toBe(8);
  });

  it("allows an explicit larger distance", () => {
    expect(parseIntent("something within 35 miles").maxMiles).toBe(35);
  });
});
