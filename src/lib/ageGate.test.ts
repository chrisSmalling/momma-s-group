import { describe, expect, it } from "vitest";
import { applyAgeGate, passesAgeGate } from "./ageGate";

describe("passesAgeGate", () => {
  it("excludes an item with no age data at all, known child age or not", () => {
    expect(passesAgeGate(24, null, null)).toBe(false);
    expect(passesAgeGate(null, null, null)).toBe(false);
  });

  it("known child age: passes only when that age falls inside the item's range", () => {
    expect(passesAgeGate(24, 12, 48)).toBe(true);
    expect(passesAgeGate(24, 37, 60)).toBe(false); // the ticket's "off-age" case
    expect(passesAgeGate(48, 37, 60)).toBe(true); // same item, older child
  });

  it("known child age: an open-ended stated bound is a real fact, not unknown", () => {
    expect(passesAgeGate(24, 18, null)).toBe(true); // "18mo+"
    expect(passesAgeGate(12, 18, null)).toBe(false); // too young for "18mo+"
    expect(passesAgeGate(24, null, 36)).toBe(true); // "up to 36mo"
    expect(passesAgeGate(48, null, 36)).toBe(false);
  });

  it("no saved child age: falls back to the default toddler window, item range must fit fully inside it", () => {
    expect(passesAgeGate(null, 0, 36)).toBe(true);
    expect(passesAgeGate(null, 12, 48)).toBe(true);
    expect(passesAgeGate(null, 37, 60)).toBe(false); // extends past the default window
    expect(passesAgeGate(null, 60, 96)).toBe(false);
  });

  it("no saved child age: an open-ended upper bound never passes the default window", () => {
    expect(passesAgeGate(null, 18, null)).toBe(false);
  });
});

describe("applyAgeGate", () => {
  it("filters a mixed list down to only age-appropriate items", () => {
    const items = [
      { id: "toddler-range", age_min_months: 12, age_max_months: 48 },
      { id: "big-kid-range", age_min_months: 37, age_max_months: 60 },
      { id: "no-age-data", age_min_months: null, age_max_months: null },
    ];
    expect(applyAgeGate(items, 24).map((i) => i.id)).toEqual(["toddler-range"]);
    expect(applyAgeGate(items, 48).map((i) => i.id)).toEqual(["toddler-range", "big-kid-range"]);
    expect(applyAgeGate(items, null).map((i) => i.id)).toEqual(["toddler-range"]);
  });
});
