import { describe, expect, it } from "vitest";
import { calculateDepositStatus, deriveInstallmentStatus } from "./receivables";

describe("receivables", () => {
  it("derives installment state without floating point arithmetic", () => {
    expect(
      deriveInstallmentStatus({
        amountMinor: BigInt(1000),
        paidAmountMinor: BigInt(0),
        dueDate: "2026-01-01",
        today: "2026-01-02",
        planOpen: true,
      }),
    ).toBe("past_due");
    expect(
      deriveInstallmentStatus({
        amountMinor: BigInt(1000),
        paidAmountMinor: BigInt(500),
        dueDate: "2026-01-01",
        today: "2026-01-02",
        planOpen: true,
      }),
    ).toBe("partially_paid");
  });
  it("satisfies only confirmed deposit amounts", () => {
    expect(calculateDepositStatus(BigInt(1000), BigInt(999))).toBe("pending");
    expect(calculateDepositStatus(BigInt(1000), BigInt(1000))).toBe("satisfied");
  });
});
