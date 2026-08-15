import { createHash } from "node:crypto";
import type {
  HostedCheckout,
  HostedCheckoutCommand,
  HostedCheckoutPort,
} from "../../application/ports/hosted-checkout";
import { assertMoney } from "../../domain/money";

export type FakeStripePayment = {
  paymentIntentId: string;
  sessionId: string;
  amountMinor: bigint;
  currency: string;
  status: "succeeded" | "pending" | "failed";
  accountId: string;
  externalReference: string;
};

export class FakeStripeServer {
  private readonly sessions = new Map<string, HostedCheckoutCommand>();
  private readonly payments = new Map<string, FakeStripePayment>();
  exchangeCode(code: string) {
    if (!code.startsWith("fake_stripe_code_"))
      throw new Error("STRIPE_OAUTH_CODE_INVALID");
    return {
      stripeUserId: `acct_fake_${code.slice(-12)}`,
      scope: "read_write",
      livemode: false,
    };
  }
  getAccount(accountId: string) {
    if (!accountId.startsWith("acct_fake_")) throw new Error("STRIPE_ACCOUNT_INVALID");
    return {
      id: accountId,
      country: "MX",
      defaultCurrency: "mxn",
      businessName: "Agency ***",
      detailsSubmitted: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      cardPayments: "active",
      requirements: [] as string[],
      type: "standard" as const,
    };
  }
  createCheckout(command: HostedCheckoutCommand, accountId: string) {
    assertMoney(command.currency, command.amountMinor);
    const id = `cs_fake_${command.paymentRequestId}`;
    this.sessions.set(`${accountId}:${id}`, command);
    return {
      id,
      url: `https://checkout.stripe.local/pay/${id}`,
      accountId,
      digest: createHash("sha256")
        .update(`${id}:${command.externalReference}`)
        .digest("hex"),
    };
  }
  completeCheckout(sessionId: string, accountId: string) {
    const command = this.sessions.get(`${accountId}:${sessionId}`);
    if (!command) throw new Error("STRIPE_SESSION_NOT_FOUND");
    const payment = {
      paymentIntentId: `pi_fake_${sessionId}`,
      sessionId,
      amountMinor: command.amountMinor,
      currency: command.currency.toLowerCase(),
      status: "succeeded" as const,
      accountId,
      externalReference: command.externalReference,
    };
    this.payments.set(`${accountId}:${payment.paymentIntentId}`, payment);
    return payment;
  }
  getPayment(paymentIntentId: string, accountId: string) {
    const payment = this.payments.get(`${accountId}:${paymentIntentId}`);
    if (!payment) throw new Error("STRIPE_PAYMENT_NOT_FOUND");
    return payment;
  }
}
export const fakeStripeServer = new FakeStripeServer();
export class FakeStripeAdapter implements HostedCheckoutPort {
  constructor(private readonly accountId: string) {}
  getCapabilities() {
    return {
      hostedCheckout: true,
      authoritativeFetch: true,
      webhookVerification: true,
      expiry: true,
    };
  }
  async createCheckout(command: HostedCheckoutCommand): Promise<HostedCheckout> {
    const result = fakeStripeServer.createCheckout(command, this.accountId);
    return {
      externalCheckoutId: result.id,
      hostedUrl: result.url,
      status: "open",
      expiresAt: command.expiresAt,
      providerRequestId: `stripe-fake-request-${command.paymentRequestId}`,
      rawDigest: result.digest,
    };
  }
  async fetchPayment(externalPaymentId: string) {
    const payment = fakeStripeServer.getPayment(externalPaymentId, this.accountId);
    return {
      status:
        payment.status === "succeeded"
          ? ("confirmed" as const)
          : payment.status === "failed"
            ? ("failed" as const)
            : ("pending" as const),
      amountMinor: payment.amountMinor,
      currency: payment.currency.toUpperCase(),
      externalPaymentId: payment.paymentIntentId,
    };
  }
}
