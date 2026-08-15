import { describe, expect, it } from "vitest";
import { signStripeWebhook, verifyStripeWebhook } from "./stripe";
import { fakeStripeServer } from "../infrastructure/providers/stripe";
describe("Stripe Connect webhook", () => {
  it("verifies signed raw body and rejects stale events", () => {
    const raw = '{"type":"checkout.session.completed"}';
    const secret = "fake-stripe-webhook";
    const now = 1_700_000_000;
    const signature = signStripeWebhook(raw, secret, now);
    expect(verifyStripeWebhook(raw, signature, secret, 300, now)).toBe(true);
    expect(verifyStripeWebhook(raw, signature, secret, 300, now + 301)).toBe(false);
  });
});

describe("Stripe fake direct checkout", () => {
  it("scopes the session to the connected account without platform fees", () => {
    const command = {
      tenantId: "tenant-a",
      connectionId: "connection-a",
      paymentRequestId: "request-a",
      idempotencyKey: "idempotency-a",
      amountMinor: BigInt(1500),
      currency: "MXN",
      description: "Servicio",
      externalReference: "opaque-ref",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
    };
    const session = fakeStripeServer.createCheckout(command, "acct_fake_a");
    expect(session.url).toContain("checkout.stripe.local");
    const payment = fakeStripeServer.completeCheckout(session.id, "acct_fake_a");
    expect(payment.accountId).toBe("acct_fake_a");
    expect(
      JSON.stringify(command, (_, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    ).not.toMatch(
      /application_fee_amount|transfer_data|destination|on_behalf_of|transfer_group/,
    );
  });
});
