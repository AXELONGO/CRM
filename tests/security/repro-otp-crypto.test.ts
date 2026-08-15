import { afterEach, describe, expect, it } from "vitest";
import { createOtp, verifyOtp } from "../../src/modules/agreements/domain/crypto";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("repro B-01/B-02: OTP secrets and startup guards", () => {
  it("REQUIRES a configured AGREEMENT_CHALLENGE_HMAC_KEY in production (no silent fallback)", () => {
    delete process.env.AGREEMENT_CHALLENGE_HMAC_KEY;
    process.env.NODE_ENV = "production";
    expect(() => createOtp()).toThrow(/AGREEMENT_CHALLENGE_HMAC_KEY/i);
  });

  it("REJECTS OTP operations when E2E_OTP_PRINT or capture adapters are enabled in production", () => {
    process.env.NODE_ENV = "production";
    process.env.AGREEMENT_CHALLENGE_HMAC_KEY = "a-real-independent-32-byte-key!!";
    process.env.E2E_OTP_PRINT = "true";
    expect(() => createOtp()).toThrow(/E2E_OTP_PRINT/i);
  });

  it("does not expose the plaintext code in any returned value from production code paths", () => {
    process.env.NODE_ENV = "production";
    process.env.AGREEMENT_CHALLENGE_HMAC_KEY = "a-real-independent-32-byte-key!!";
    const otp = createOtp();
    expect(otp).not.toHaveProperty("code");
  });

  it("verifies only when the digest matches under the same secret (constant-time, equal length)", () => {
    process.env.AGREEMENT_CHALLENGE_HMAC_KEY = "a-real-independent-32-byte-key!!";
    const otp = createOtp("a-real-independent-32-byte-key!!");
    expect(verifyOtp(otp.code, otp.hash, "a-real-independent-32-byte-key!!")).toBe(
      true,
    );
    expect(verifyOtp("000000", otp.hash, "a-real-independent-32-byte-key!!")).toBe(
      false,
    );
    expect(verifyOtp(otp.code, otp.hash, "another-independent-32-byte-key!!")).toBe(
      false,
    );
  });
});
