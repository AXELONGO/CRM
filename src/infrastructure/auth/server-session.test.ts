import { describe, expect, it } from "vitest";
import { isVerifiedSession } from "./server-session";

describe("server session access", () => {
  it("rejects an absent session", () => {
    expect(isVerifiedSession(null)).toBe(false);
  });

  it("rejects an unverified email", () => {
    expect(isVerifiedSession({ user: { emailVerified: false } })).toBe(false);
  });

  it("accepts only a verified session", () => {
    expect(isVerifiedSession({ user: { emailVerified: true } })).toBe(true);
  });
});
