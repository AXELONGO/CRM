import { describe, expect, it } from "vitest";
import { assertContentTransition, assertPlannedDate } from "./state";

describe("content planning state", () => {
  it("keeps editorial transitions explicit", () => {
    expect(() => assertContentTransition("idea", "brief")).not.toThrow();
    expect(() => assertContentTransition("idea", "published")).toThrow(
      "CONTENT_TRANSITION_INVALID",
    );
  });
  it("validates date and timezone intent", () => {
    expect(() => assertPlannedDate("2026-08-20", "America/Tijuana")).not.toThrow();
    expect(() => assertPlannedDate("20/08/2026", "America/Tijuana")).toThrow(
      "CONTENT_DATE_INVALID",
    );
  });
});
