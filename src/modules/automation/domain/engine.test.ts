import { describe, expect, it } from "vitest";
import { simulateAutomationRule } from "../application/simulation";
import {
  actionIdempotencyKey,
  evaluateAutomation,
  validateAutomationDefinition,
} from "./engine";

describe("automation engine", () => {
  it("evaluates the closed condition and action vocabulary without executing code", () => {
    const definition = validateAutomationDefinition({
      conditions: [{ path: "opportunity.amount", operator: "gte", value: 100 }],
      actions: [{ type: "create_reminder", params: { title: "Follow up" } }],
    });
    expect(
      evaluateAutomation(definition, { opportunity: { amount: 150 } }, 0).matched,
    ).toBe(true);
    expect(
      evaluateAutomation(definition, { opportunity: { amount: 10 } }, 0).actions,
    ).toEqual([]);
  });
  it("rejects unknown actions and causation loops", () => {
    expect(() =>
      validateAutomationDefinition({ actions: [{ type: "run_sql", params: {} }] }),
    ).toThrow("invalid_action_type");
    const definition = validateAutomationDefinition({
      actions: [{ type: "emit_event", params: {} }],
    });
    expect(evaluateAutomation(definition, {}, 6).reason).toBe(
      "causation_depth_exceeded",
    );
  });
  it("creates stable idempotency keys", () => {
    expect(actionIdempotencyKey("t", "e", "v", 2)).toBe("t:e:v:2");
  });
  it("simulates without mutating the supplied payload", () => {
    const payload = { opportunity: { amount: 150 } };
    const result = simulateAutomationRule({
      definition: {
        conditions: [{ path: "opportunity.amount", operator: "gte", value: 100 }],
        actions: [{ type: "create_notification", params: { title: "Aviso" } }],
      },
      payload,
    });
    expect(result).toMatchObject({ matched: true, reason: "matched" });
    expect(result.actions).toHaveLength(1);
    expect(payload).toEqual({ opportunity: { amount: 150 } });
  });
});
