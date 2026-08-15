import { describe, expect, it } from "vitest";
import { activationReadiness, assertProjectTransition } from "./activation";

describe("project activation", () => {
  it("reports waiting, blocked, error and ready distinctly", () => {
    const base = {
      type: "accepted_quote" as const,
      reasonCode: "test",
      humanMessage: "test",
    };
    expect(activationReadiness([{ ...base, status: "pending" }])).toBe("waiting");
    expect(activationReadiness([{ ...base, status: "failed" }])).toBe("blocked");
    expect(activationReadiness([{ ...base, status: "unavailable" }])).toBe("error");
    expect(activationReadiness([{ ...base, status: "satisfied" }])).toBe("ready");
  });

  it("rejects activating a project without the pending state", () => {
    expect(() => assertProjectTransition("draft", "active")).toThrow(
      "PROJECT_TRANSITION_INVALID",
    );
    expect(() => assertProjectTransition("activation_pending", "active")).not.toThrow();
  });
});
