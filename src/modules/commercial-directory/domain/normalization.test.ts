import { describe, expect, it } from "vitest";
import {
  normalizeContactMethod,
  normalizeDisplayName,
  normalizePhone,
} from "./normalization";

describe("commercial directory normalization", () => {
  it("preserves international names while normalizing whitespace", () => {
    expect(normalizeDisplayName("  María   José O'Connor  ")).toBe(
      "María José O'Connor",
    );
  });

  it("normalizes email and explicit-country phone values", () => {
    expect(normalizeContactMethod("email", "  Persona@Example.TEST ")).toBe(
      "persona@example.test",
    );
    expect(normalizePhone("55 1234 5678", "+52")).toBe("+525512345678");
  });

  it("rejects ambiguous national phone values", () => {
    expect(() => normalizePhone("55 1234 5678")).toThrow("PHONE_COUNTRY_REQUIRED");
  });
});
