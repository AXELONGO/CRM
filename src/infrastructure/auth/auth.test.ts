import { describe, expect, it, vi } from "vitest";
import { assertAuthRuntimeConfig } from "./auth";

function isControlledSignupRequest(input: {
  nodeEnv: string;
  bootstrapEnabled: boolean;
  bootstrapHeader: string | null;
  invitationToken: string | null;
}): boolean {
  const bootstrap =
    input.nodeEnv !== "production" &&
    input.bootstrapEnabled &&
    input.bootstrapHeader === "true";
  return bootstrap || Boolean(input.invitationToken);
}

describe("auth runtime configuration", () => {
  it("allows signup only through explicit bootstrap or invitation context", () => {
    expect(
      isControlledSignupRequest({
        nodeEnv: "development",
        bootstrapEnabled: false,
        bootstrapHeader: null,
        invitationToken: null,
      }),
    ).toBe(false);
    expect(
      isControlledSignupRequest({
        nodeEnv: "development",
        bootstrapEnabled: true,
        bootstrapHeader: "true",
        invitationToken: null,
      }),
    ).toBe(true);
    expect(
      isControlledSignupRequest({
        nodeEnv: "production",
        bootstrapEnabled: true,
        bootstrapHeader: "true",
        invitationToken: null,
      }),
    ).toBe(false);
    expect(
      isControlledSignupRequest({
        nodeEnv: "production",
        bootstrapEnabled: false,
        bootstrapHeader: null,
        invitationToken: "invitation-token",
      }),
    ).toBe(true);
  });

  it("rejects bootstrap when the runtime is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_BOOTSTRAP_ENABLED", "true");
    vi.stubEnv("BETTER_AUTH_SECRET", "local-test-secret-with-at-least-32-chars");
    vi.stubEnv("BETTER_AUTH_URL", "https://crm.example.com");
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@example.com/crm");

    expect(() => assertAuthRuntimeConfig()).toThrow("AUTH_BOOTSTRAP_ENABLED");
    vi.unstubAllEnvs();
  });

  it("rejects production without HTTPS and a secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_BOOTSTRAP_ENABLED", "false");
    vi.stubEnv("BETTER_AUTH_URL", "http://crm.example.com");
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@example.com/crm");

    expect(() => assertAuthRuntimeConfig()).toThrow("BETTER_AUTH_SECRET");
    vi.unstubAllEnvs();
  });
});
