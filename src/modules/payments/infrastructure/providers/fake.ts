import { createHash } from "node:crypto";
import type {
  HostedCheckout,
  HostedCheckoutCommand,
  HostedCheckoutPort,
} from "../../application/ports/hosted-checkout";

export class FakeHostedCheckoutAdapter implements HostedCheckoutPort {
  private readonly payments = new Map<
    string,
    { amountMinor: bigint; currency: string }
  >();

  getCapabilities() {
    return {
      hostedCheckout: true,
      authoritativeFetch: true,
      webhookVerification: true,
      expiry: true,
    };
  }

  async createCheckout(command: HostedCheckoutCommand): Promise<HostedCheckout> {
    const id = `fake_checkout_${command.paymentRequestId}`;
    this.payments.set(id, {
      amountMinor: command.amountMinor,
      currency: command.currency,
    });
    return {
      externalCheckoutId: id,
      hostedUrl: `http://localhost:3000/pay/fake/${encodeURIComponent(id)}`,
      status: "open",
      expiresAt: command.expiresAt,
      providerRequestId: `fake-request-${command.paymentRequestId}`,
      rawDigest: createHash("sha256").update(command.externalReference).digest("hex"),
    };
  }

  async fetchPayment(externalPaymentId: string) {
    const payment = this.payments.get(externalPaymentId);
    if (!payment) throw new Error("PAYMENT_EXTERNAL_NOT_FOUND");
    return {
      status: "confirmed" as const,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      externalPaymentId: `fake_payment_${externalPaymentId}`,
    };
  }
}
