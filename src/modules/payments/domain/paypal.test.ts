import { describe, expect, it } from "vitest";
import { fakePayPalServer } from "../infrastructure/providers/paypal";
import { signPayPalWebhook, verifyPayPalWebhook } from "./paypal";
describe("PayPal fake", () => {
  it("runs referral, order approval and capture", () => {
    const referral = fakePayPalServer.createPartnerReferral();
    expect(referral.actionUrl).toContain("paypal.local");
    const order = fakePayPalServer.createOrder(
      {
        tenantId: "t",
        connectionId: "c",
        paymentRequestId: "r",
        idempotencyKey: "id",
        amountMinor: BigInt(1000),
        currency: "MXN",
        description: "Servicio",
        externalReference: "opaque",
        successUrl: "http://localhost/s",
        cancelUrl: "http://localhost/c",
      },
      "merchant_fake_a",
    );
    fakePayPalServer.approveOrder(order.id);
    const capture = fakePayPalServer.captureOrder(order.id);
    expect(capture.status).toBe("COMPLETED");
    expect(capture.feeMinor).toBe(BigInt(50));
  });
  it("verifies raw webhook signatures", () => {
    const raw = '{"event_type":"PAYMENT.CAPTURE.COMPLETED"}';
    const signature = signPayPalWebhook(raw, "fake-paypal-webhook");
    expect(verifyPayPalWebhook(raw, signature, "fake-paypal-webhook")).toBe(true);
    expect(verifyPayPalWebhook(raw + "x", signature, "fake-paypal-webhook")).toBe(
      false,
    );
  });
});
