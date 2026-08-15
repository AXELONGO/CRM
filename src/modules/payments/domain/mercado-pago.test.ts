import { describe, expect, it } from "vitest";
import { createOAuthState, equalOAuthState, mercadoPagoOAuthUrl } from "./mercado-pago";
describe("Mercado Pago OAuth fake", () => {
  it("uses a one-time opaque state hash", () => {
    const state = createOAuthState();
    expect(state).not.toContain("tenant");
    expect(
      equalOAuthState(
        state,
        require("node:crypto").createHash("sha256").update(state).digest("hex"),
      ),
    ).toBe(true);
    expect(
      equalOAuthState(
        "wrong",
        require("node:crypto").createHash("sha256").update(state).digest("hex"),
      ),
    ).toBe(false);
  });
  it("builds an allowlisted fake authorization URL", () => {
    expect(
      mercadoPagoOAuthUrl("fake-client", "http://localhost:3000/callback", "state"),
    ).toContain("client_id=fake-client");
  });
});
