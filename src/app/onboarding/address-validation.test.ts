import { describe, expect, it } from "vitest";

function isValidHomeAddress(street: string, city: string, state: string, zip: string) {
  return Boolean(
    street.trim() &&
    city.trim() &&
    /^[A-Z]{2}$/.test(state.trim().toUpperCase()) &&
    /^\d{5}(?:-\d{4})?$/.test(zip.trim()),
  );
}

describe("onboarding home address validation", () => {
  it("accepts a complete US address", () => {
    expect(isValidHomeAddress("123 Main St", "Wesley Chapel", "fl", "33544")).toBe(true);
  });

  it("rejects incomplete addresses without treating them as an onboarding blocker", () => {
    expect(isValidHomeAddress("", "", "", "")).toBe(false);
    expect(isValidHomeAddress("123 Main St", "", "FL", "33544")).toBe(false);
  });

  it("rejects malformed state and ZIP values", () => {
    expect(isValidHomeAddress("123 Main St", "Wesley Chapel", "Florida", "33544")).toBe(false);
    expect(isValidHomeAddress("123 Main St", "Wesley Chapel", "FL", "3354")).toBe(false);
  });

  it("accepts ZIP+4", () => {
    expect(isValidHomeAddress("123 Main St", "Wesley Chapel", "FL", "33544-1234")).toBe(true);
  });
});
