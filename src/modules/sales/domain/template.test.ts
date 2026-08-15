import { describe, expect, it } from "vitest";
import { defaultPipelineTemplate } from "./template";
import { makeMoney, weightedMinor } from "./money";
import { assertPricingModel, assertStateTransition } from "./state";

describe("sales domain", () => {
  it("has an initial professional services template", () => {
    expect(defaultPipelineTemplate.stages).toHaveLength(5);
    expect(defaultPipelineTemplate.stages[0].initial).toBe(true);
  });
  it("keeps money exact in minor units", () => {
    expect(makeMoney("MXN", 12500)).toEqual({ currency: "MXN", minor: BigInt(12500) });
    expect(weightedMinor(10000, 70)).toBe(7000);
  });
  it("allows only explicit terminal and reopen transitions", () => {
    expect(() => assertStateTransition("open", "won")).not.toThrow();
    expect(() => assertStateTransition("won", "lost")).toThrow(
      "OPPORTUNITY_TRANSITION_INVALID",
    );
  });
  it("requires model-specific commercial values", () => {
    expect(() =>
      assertPricingModel({ pricingModel: "retainer", estimatedValueMinor: 100 }),
    ).toThrow("RETAINER_MONTHLY_REQUIRED");
    expect(() =>
      assertPricingModel({
        pricingModel: "other",
        estimatedValueMinor: 100,
        pricingExplanation: "Consultoria especial",
      }),
    ).not.toThrow();
  });
});
