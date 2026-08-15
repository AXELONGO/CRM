import { describe, expect, it } from "vitest";
import { createOpaqueToken, createOtp, verifyOtp } from "./crypto";

describe("agreement security primitives", () => {
  it("never stores an opaque token in its hash", () => {
    const token = createOpaqueToken();
    expect(token.token).not.toBe(token.hash);
    expect(token.hash).toHaveLength(64);
  });

  it("verifies an OTP only with the correct secret and code", () => {
    const key = "test-agreement-challenge-key-32!!";
    const otp = createOtp(key);
    if (!otp.code) throw new Error("otp.code expected in test env");
    expect(verifyOtp(otp.code, otp.hash, key)).toBe(true);
    expect(verifyOtp("000000", otp.hash, key)).toBe(false);
    expect(verifyOtp(otp.code, otp.hash, "wrong-agreement-challenge-key-32!!")).toBe(
      false,
    );
  });
});
