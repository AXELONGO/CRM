import { describe, expect, it } from "vitest";
import { assertAgreementTransition, assertRecipientCanAct } from "./state";

describe("agreement state machine", () => {
  it("allows issue only from ready_to_issue", () => {
    expect(() => assertAgreementTransition("ready_to_issue", "issued")).not.toThrow();
    expect(() => assertAgreementTransition("executed", "draft")).toThrow(
      "AGREEMENT_STATE_TRANSITION_INVALID",
    );
  });

  it("blocks recipients that are not available or viewed", () => {
    expect(() => assertRecipientCanAct("available")).not.toThrow();
    expect(() => assertRecipientCanAct("pending")).toThrow("RECIPIENT_NOT_AVAILABLE");
  });
});
