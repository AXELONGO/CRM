import { describe, expect, it } from "vitest";
import { sha256Canonical } from "@/modules/agreements/domain/canonical";

describe("AcceptedCommercialScope", () => {
  it("uses the canonical snapshot hash contract", () => {
    const snapshot = { currency: "MXN", totalMinor: "10000" };
    expect(sha256Canonical(snapshot)).toHaveLength(64);
  });
});
