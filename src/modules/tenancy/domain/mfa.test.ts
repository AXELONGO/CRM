import { describe, expect, it } from "vitest";
import { requiresPrivilegedMfa } from "./mfa";

describe("privileged MFA policy", () => {
  it("requires MFA for privileged identities", () => {
    expect(requiresPrivilegedMfa([], true)).toBe(true);
    expect(requiresPrivilegedMfa(["tenant_admin"], false)).toBe(true);
    expect(requiresPrivilegedMfa(["finance"], false)).toBe(true);
  });

  it("does not require MFA for non-privileged identities", () => {
    expect(requiresPrivilegedMfa(["sales"], false)).toBe(false);
    expect(requiresPrivilegedMfa(["execution"], false)).toBe(false);
    expect(requiresPrivilegedMfa(["client"], false)).toBe(false);
  });
});
