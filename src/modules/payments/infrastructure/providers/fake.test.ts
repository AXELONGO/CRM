import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { verifyFakeWebhookSignature } from "../repositories";
import { DisabledPaymentProviderAdapter } from "./disabled";
import { FakeHostedCheckoutAdapter } from "./fake";
import {
  FakeMercadoPagoAdapter,
  FakePayPalAdapter,
  FakeStripeAdapter,
} from "./fake-providers";

const command = {
  tenantId: "tenant_test",
  connectionId: "connection_test",
  paymentRequestId: "request_test",
  idempotencyKey: "idempotency_test_123456",
  amountMinor: BigInt(12500),
  currency: "MXN",
  description: "Servicio de prueba",
  externalReference: "reference_test",
  successUrl: "http://localhost:3000/pay/success",
  cancelUrl: "http://localhost:3000/pay/cancel",
};

describe("payment provider adapters", () => {
  it("creates a fake hosted checkout with stable identity", async () => {
    const adapter = new FakeHostedCheckoutAdapter();
    const first = await adapter.createCheckout(command);
    const second = await adapter.createCheckout(command);
    expect(first.externalCheckoutId).toBe(second.externalCheckoutId);
    expect(first.hostedUrl).toContain("localhost:3000");
    expect(adapter.getCapabilities()).toEqual({
      hostedCheckout: true,
      authoritativeFetch: true,
      webhookVerification: true,
      expiry: true,
    });
  });

  it("keeps real providers explicitly disabled", async () => {
    const adapter = new DisabledPaymentProviderAdapter("stripe");
    expect(adapter.getCapabilities().hostedCheckout).toBe(false);
    await expect(adapter.createCheckout(command)).rejects.toThrow(
      "PAYMENT_PROVIDER_STRIPE_DISABLED",
    );
  });

  it("provides isolated fake adapters for each provider contract", () => {
    expect(new FakeStripeAdapter().getCapabilities().hostedCheckout).toBe(true);
    expect(new FakeMercadoPagoAdapter().getCapabilities().authoritativeFetch).toBe(
      true,
    );
    expect(new FakePayPalAdapter().getCapabilities().webhookVerification).toBe(true);
  });

  it("verifies fake webhook signatures before processing", () => {
    const payload = JSON.stringify({ eventId: "evt_test" });
    const signature = createHash("sha256").update(`fake:${payload}`).digest("hex");
    expect(verifyFakeWebhookSignature(payload, signature)).toBe(true);
    expect(verifyFakeWebhookSignature(`${payload}x`, signature)).toBe(false);
    expect(verifyFakeWebhookSignature(payload, null)).toBe(false);
  });
});
