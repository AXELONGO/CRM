import { describe, expect, it } from "vitest";
import { calculateLine, calculateTotals } from "./pricing";

describe("quote pricing", () => {
  it("calculates quantity, discount and tax with integer minor units", () => {
    expect(
      calculateLine({
        quantity: "1.2500",
        unitPriceMinor: BigInt(10000),
        discount: { type: "percent", value: BigInt(1000) },
        taxRateBps: BigInt(1600),
      }),
    ).toEqual({
      subtotalMinor: BigInt(12500),
      discountMinor: BigInt(1250),
      taxableMinor: BigInt(11250),
      taxMinor: BigInt(1800),
      totalMinor: BigInt(13050),
    });
  });
  it("rejects a discount greater than the line", () => {
    expect(() =>
      calculateLine({
        quantity: "1",
        unitPriceMinor: BigInt(100),
        discount: { type: "fixed", value: BigInt(101) },
        taxRateBps: BigInt(0),
      }),
    ).toThrow("DISCOUNT_INVALID");
  });
  it("keeps totals grouped by line rounding", () => {
    expect(
      calculateTotals([
        {
          quantity: "1",
          unitPriceMinor: BigInt(1),
          discount: { type: "none", value: BigInt(0) },
          taxRateBps: BigInt(1600),
        },
        {
          quantity: "1",
          unitPriceMinor: BigInt(1),
          discount: { type: "none", value: BigInt(0) },
          taxRateBps: BigInt(1600),
        },
      ]).totalMinor,
    ).toBe(BigInt(2));
  });
});
