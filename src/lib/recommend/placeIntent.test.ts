import { describe, expect, it } from "vitest";
import { detectPlaceSearchTerm } from "./placeIntent";

describe("detectPlaceSearchTerm", () => {
  it("extracts the activity from the primary example query", () => {
    expect(detectPlaceSearchTerm("Where can I take her for gymnastics?")).toBe("gymnastics");
  });

  it("extracts the activity from common phrasing variants", () => {
    expect(detectPlaceSearchTerm("any gymnastics places")).toBe("gymnastics");
    expect(detectPlaceSearchTerm("swim classes near me")).toBe("swim");
    expect(detectPlaceSearchTerm("looking for a gymnastics place")).toBe("gymnastics");
    expect(detectPlaceSearchTerm("a music class")).toBe("music");
    expect(detectPlaceSearchTerm("places for rock climbing")).toBe("rock climbing");
    expect(detectPlaceSearchTerm("need swim lessons")).toBe("swim");
    expect(detectPlaceSearchTerm("where could we go for a dance class")).toBe("dance");
  });

  it("does not hijack ordinary event/mood queries", () => {
    expect(detectPlaceSearchTerm("anything fun this weekend")).toBeNull();
    expect(detectPlaceSearchTerm("what's happening this weekend")).toBeNull();
    expect(detectPlaceSearchTerm("something free today")).toBeNull();
    expect(detectPlaceSearchTerm("free stuff today")).toBeNull();
    expect(detectPlaceSearchTerm("indoor fun for a rainy day")).toBeNull();
    expect(detectPlaceSearchTerm("looking for something fun")).toBeNull();
    expect(detectPlaceSearchTerm("where can I take her today")).toBeNull();
    expect(detectPlaceSearchTerm("show me outdoor activities")).toBeNull();
  });

  it("returns null for empty or purely generic input", () => {
    expect(detectPlaceSearchTerm("")).toBeNull();
    expect(detectPlaceSearchTerm("a place")).toBeNull();
    expect(detectPlaceSearchTerm("looking for a place")).toBeNull();
  });
});
