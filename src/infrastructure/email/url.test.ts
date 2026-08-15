import { describe, expect, it } from "vitest";
import { buildAuthEmailUrl } from "./url";

describe("auth email URLs", () => {
  it("accepts only the configured application origin", () => {
    expect(
      buildAuthEmailUrl(
        "http://localhost:3000/api/auth/verify-email?token=opaque",
        "http://localhost:3000",
      ),
    ).toBe("http://localhost:3000/api/auth/verify-email?token=opaque");
  });

  it("rejects an external origin", () => {
    expect(() =>
      buildAuthEmailUrl("https://evil.example/reset", "http://localhost:3000"),
    ).toThrow("origen no permitido");
  });
});
