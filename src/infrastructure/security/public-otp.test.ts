import { afterEach, describe, expect, it } from "vitest";
import {
  assertPublicOtpRuntimeSafe,
  decryptOtpDeliveryCode,
  encryptOtpDeliveryCode,
  requirePublicOtpHmacKey,
} from "./public-otp";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("public OTP security", () => {
  it("requires a quote HMAC key outside the test runtime", () => {
    expect(() => requirePublicOtpHmacKey("quote", { NODE_ENV: "production" })).toThrow(
      "QUOTE_CHALLENGE_HMAC_KEY_REQUIRED",
    );
  });

  it("rejects E2E OTP printing outside tests", () => {
    expect(() =>
      assertPublicOtpRuntimeSafe({ NODE_ENV: "development", E2E_OTP_PRINT: "true" }),
    ).toThrow("E2E_OTP_PRINT_TEST_ONLY");
  });

  it("encrypts the queued code with authenticated associated data", () => {
    const source = { NODE_ENV: "test" };
    const encrypted = encryptOtpDeliveryCode(
      "123456",
      "otp-delivery:quote-otp:id",
      source,
    );
    expect(encrypted.ciphertext).not.toContain("123456");
    expect(decryptOtpDeliveryCode(encrypted, "otp-delivery:quote-otp:id", source)).toBe(
      "123456",
    );
    expect(() =>
      decryptOtpDeliveryCode(encrypted, "otp-delivery:quote-otp:other", source),
    ).toThrow();
  });
});
