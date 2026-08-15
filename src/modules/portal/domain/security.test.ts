import { describe, expect, it } from "vitest";
import {
  createPortalToken,
  normalizePortalHostname,
  verifyPortalToken,
} from "./security";

describe("portal security", () => {
  it("stores only a hashable bearer token", () => {
    const token = createPortalToken();
    expect(token.token).not.toBe(token.hash);
    expect(verifyPortalToken(token.token, token.hash)).toBe(true);
    expect(verifyPortalToken(`${token.token}x`, token.hash)).toBe(false);
  });
  it("normalizes safe custom hostnames", () => {
    expect(normalizePortalHostname("Portal.Example.TEST.")).toBe("portal.example.test");
    expect(() => normalizePortalHostname("http://evil.test")).toThrow(
      "PORTAL_HOST_INVALID",
    );
  });
});
