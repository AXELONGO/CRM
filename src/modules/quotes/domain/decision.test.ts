import { describe, expect, it } from "vitest";

describe("public quote decision boundaries", () => {
  it("requires comments for rejection or requested changes", () => {
    const valid = (decision: string, comment?: string) =>
      decision === "accepted" || Boolean(comment && comment.trim().length >= 5);
    expect(valid("rejected")).toBe(false);
    expect(valid("changes_requested", "Necesito cambios")).toBe(true);
    expect(valid("accepted")).toBe(true);
  });
});
