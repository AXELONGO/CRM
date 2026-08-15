export type OpportunityState = "open" | "won" | "lost";

export function assertPricingModel(input: {
  pricingModel: "fixed_price" | "hourly" | "retainer" | "other";
  estimatedValueMinor: number;
  hourlyRateMinor?: number | null;
  estimatedHours?: number | null;
  retainerMonthlyMinor?: number | null;
  retainerDurationMonths?: number | null;
  pricingExplanation?: string | null;
}): void {
  const values = [
    input.estimatedValueMinor,
    input.hourlyRateMinor,
    input.retainerMonthlyMinor,
  ].filter((value): value is number => value !== null && value !== undefined);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("MONEY_INVALID");
  }
  if (
    input.pricingModel === "retainer" &&
    (input.retainerMonthlyMinor === null || input.retainerMonthlyMinor === undefined)
  ) {
    throw new Error("RETAINER_MONTHLY_REQUIRED");
  }
  if (
    input.pricingModel === "hourly" &&
    input.estimatedHours !== null &&
    input.estimatedHours !== undefined &&
    (!Number.isSafeInteger(input.estimatedHours) || input.estimatedHours <= 0)
  ) {
    throw new Error("ESTIMATED_HOURS_INVALID");
  }
  if (input.pricingModel === "other" && !input.pricingExplanation?.trim()) {
    throw new Error("PRICING_EXPLANATION_REQUIRED");
  }
}

export function assertStateTransition(
  from: OpportunityState,
  to: OpportunityState,
): void {
  if (from === to) return;
  if (from === "open" && (to === "won" || to === "lost")) return;
  if ((from === "won" || from === "lost") && to === "open") return;
  throw new Error("OPPORTUNITY_TRANSITION_INVALID");
}

export function effectiveProbability(
  override: number | null | undefined,
  stageProbability: number,
): number {
  return override ?? stageProbability;
}
