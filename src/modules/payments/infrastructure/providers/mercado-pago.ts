import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  HostedCheckout,
  HostedCheckoutCommand,
  HostedCheckoutPort,
} from "../../application/ports/hosted-checkout";
import { assertMoney } from "../../domain/money";

export type FakeMercadoPagoPayment = {
  paymentId: string;
  preferenceId: string;
  externalReference: string;
  amountMinor: bigint;
  currency: string;
  status: "pending" | "approved" | "rejected";
  sellerUserId: string;
};

export class FakeMercadoPagoServer {
  private readonly preferences = new Map<string, HostedCheckoutCommand>();
  private readonly payments = new Map<string, FakeMercadoPagoPayment>();

  exchangeAuthorizationCode(code: string) {
    if (!code.startsWith("fake_mp_code_"))
      throw new Error("MERCADO_PAGO_OAUTH_CODE_INVALID");
    return {
      accessToken: `fake_mp_access_${code.slice(-12)}`,
      refreshToken: `fake_mp_refresh_${code.slice(-12)}`,
      expiresIn: 5_400,
      userId: `fake_seller_${code.slice(-8)}`,
      scopes: ["offline_access", "read", "write"],
    };
  }

  getUser(accessToken: string) {
    if (!accessToken.startsWith("fake_mp_access_"))
      throw new Error("MERCADO_PAGO_TOKEN_INVALID");
    return {
      userId: `fake_seller_${accessToken.slice(-8)}`,
      nickname: "seller_***",
      email: "s***@example.invalid",
      countryCode: "MX",
      siteId: "MLM",
    };
  }

  createPreference(command: HostedCheckoutCommand, sellerUserId: string) {
    assertMoney(command.currency, command.amountMinor);
    const preferenceId = `fake_mp_preference_${command.paymentRequestId}`;
    this.preferences.set(preferenceId, command);
    return {
      id: preferenceId,
      initPoint: `https://fake.mercadopago.local/checkout/${preferenceId}`,
      sandboxInitPoint: `https://fake.mercadopago.local/checkout/${preferenceId}`,
      sellerUserId,
      digest: createHash("sha256")
        .update(`${preferenceId}:${command.externalReference}`)
        .digest("hex"),
    };
  }

  fetchPayment(paymentId: string, sellerUserId: string): FakeMercadoPagoPayment {
    const payment = this.payments.get(paymentId);
    if (!payment || payment.sellerUserId !== sellerUserId)
      throw new Error("MERCADO_PAGO_PAYMENT_NOT_FOUND");
    return payment;
  }

  getPaymentForWebhook(paymentId: string) {
    const payment = this.payments.get(paymentId);
    if (!payment) throw new Error("MERCADO_PAGO_PAYMENT_NOT_FOUND");
    return payment;
  }

  approvePreference(preferenceId: string, sellerUserId: string) {
    const command = this.preferences.get(preferenceId);
    if (!command) throw new Error("MERCADO_PAGO_PREFERENCE_NOT_FOUND");
    const payment = {
      paymentId: `fake_mp_payment_${preferenceId}`,
      preferenceId,
      externalReference: command.externalReference,
      amountMinor: command.amountMinor,
      currency: command.currency,
      status: "approved" as const,
      sellerUserId,
    };
    this.payments.set(payment.paymentId, payment);
    return payment;
  }
}

export const fakeMercadoPagoServer = new FakeMercadoPagoServer();

export class FakeMercadoPagoAdapter implements HostedCheckoutPort {
  constructor(private readonly sellerUserId = "fake_seller_default") {}
  getCapabilities() {
    return {
      hostedCheckout: true,
      authoritativeFetch: true,
      webhookVerification: true,
      expiry: true,
    };
  }
  async createCheckout(command: HostedCheckoutCommand): Promise<HostedCheckout> {
    const result = fakeMercadoPagoServer.createPreference(command, this.sellerUserId);
    return {
      externalCheckoutId: result.id,
      hostedUrl: result.sandboxInitPoint,
      status: "open",
      expiresAt: command.expiresAt,
      providerRequestId: `fake-mp-request-${command.paymentRequestId}`,
      rawDigest: result.digest,
    };
  }
  async fetchPayment(externalPaymentId: string) {
    const payment = fakeMercadoPagoServer.fetchPayment(
      externalPaymentId,
      this.sellerUserId,
    );
    return {
      status:
        payment.status === "approved"
          ? ("confirmed" as const)
          : payment.status === "rejected"
            ? ("failed" as const)
            : ("pending" as const),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      externalPaymentId: payment.paymentId,
    };
  }
}

export function signMercadoPagoWebhook(raw: string, secret: string) {
  return createHmac("sha256", secret).update(raw).digest("hex");
}
export function verifyMercadoPagoWebhook(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!signature) return false;
  const expected = Buffer.from(signMercadoPagoWebhook(raw, secret), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
