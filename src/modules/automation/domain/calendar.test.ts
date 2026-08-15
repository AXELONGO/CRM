import { describe, expect, it } from "vitest";
import { addBusinessMinutes, isBusinessInstant } from "./calendar";

const calendar = {
  timezone: "America/Mexico_City",
  intervals: [
    { isoDay: 1, startLocal: "09:00", endLocal: "17:00" },
    { isoDay: 2, startLocal: "09:00", endLocal: "17:00" },
    { isoDay: 3, startLocal: "09:00", endLocal: "17:00" },
    { isoDay: 4, startLocal: "09:00", endLocal: "17:00" },
    { isoDay: 5, startLocal: "09:00", endLocal: "17:00" },
  ],
  exceptions: [],
} as const;

describe("business calendar", () => {
  it("uses the IANA timezone and skips weekends", () => {
    expect(isBusinessInstant(new Date("2026-08-10T16:00:00.000Z"), calendar)).toBe(
      true,
    );
    expect(isBusinessInstant(new Date("2026-08-09T16:00:00.000Z"), calendar)).toBe(
      false,
    );
  });
  it("adds business minutes rather than wall-clock minutes", () => {
    const due = addBusinessMinutes(new Date("2026-08-14T22:00:00.000Z"), 120, calendar);
    expect(due.toISOString().startsWith("2026-08-17T16:")).toBe(true);
  });
});
