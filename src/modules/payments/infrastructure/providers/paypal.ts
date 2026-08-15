import { createHash } from "node:crypto";
import type {
  HostedCheckout,
  HostedCheckoutCommand,
  HostedCheckoutPort,
} from "../../application/ports/hosted-checkout";
import { assertMoney } from "../../domain/money";

export type FakePayPalOrder = {
  orderId: string;
  merchantId: string;
  amountMinor: bigint;
  currency: string;
  externalReference: string;
  status: "CREATED" | "APPROVED" | "COMPLETED" | "VOIDED";
  captureId?: string;
  feeMinor?: bigint;
};
export class FakePayPalServer {
  private readonly orders = new Map<string, FakePayPalOrder>();
  createPartnerReferral() {
    return {
      actionUrl: `https://www.paypal.local/onboarding/${crypto.randomUUID()}`,
      actionRef: `fake-action-${crypto.randomUUID()}`,
    };
  }
  getMerchant(merchantId: string) {
    if (!merchantId.startsWith("merchant_fake_"))
      throw new Error("PAYPAL_MERCHANT_NOT_FOUND");
    return {
      merchantId,
      email: "seller@example.invalid",
      countryCode: "MX",
      product: "PPCP",
      paymentsReceivable: true,
      consentStatus: "active",
      capabilities: ["PAYMENT", "REFUND"],
    };
  }
  createOrder(command: HostedCheckoutCommand, merchantId: string) {
    assertMoney(command.currency, command.amountMinor);
    const orderId = `fake_paypal_order_${command.paymentRequestId}`;
    this.orders.set(orderId, {
      orderId,
      merchantId,
      amountMinor: command.amountMinor,
      currency: command.currency,
      externalReference: command.externalReference,
      status: "CREATED",
    });
    return {
      id: orderId,
      approveUrl: `https://www.paypal.local/checkoutnow?token=${orderId}`,
      digest: createHash("sha256").update(orderId).digest("hex"),
    };
  }
  approveOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error("PAYPAL_ORDER_NOT_FOUND");
    order.status = "APPROVED";
    return order;
  }
  captureOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order || order.status !== "APPROVED")
      throw new Error("PAYPAL_ORDER_NOT_APPROVED");
    order.status = "COMPLETED";
    order.captureId = `fake_paypal_capture_${orderId}`;
    order.feeMinor = order.amountMinor / BigInt(20);
    return order;
  }
  getOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error("PAYPAL_ORDER_NOT_FOUND");
    return order;
  }
}
export const fakePayPalServer = new FakePayPalServer();
export class FakePayPalAdapter implements HostedCheckoutPort {
  constructor(private readonly merchantId: string) {}
  getCapabilities() {
    return {
      hostedCheckout: true,
      authoritativeFetch: true,
      webhookVerification: true,
      expiry: true,
    };
  }
  async createCheckout(command: HostedCheckoutCommand): Promise<HostedCheckout> {
    const order = fakePayPalServer.createOrder(command, this.merchantId);
    return {
      externalCheckoutId: order.id,
      hostedUrl: order.approveUrl,
      status: "open",
      expiresAt: command.expiresAt,
      providerRequestId: `paypal-request-${command.paymentRequestId}`,
      rawDigest: order.digest,
    };
  }
  async fetchPayment(externalPaymentId: string) {
    const order = fakePayPalServer.getOrder(externalPaymentId);
    return {
      status:
        order.status === "COMPLETED"
          ? ("confirmed" as const)
          : order.status === "VOIDED"
            ? ("failed" as const)
            : ("pending" as const),
      amountMinor: order.amountMinor,
      currency: order.currency,
      externalPaymentId: order.captureId ?? order.orderId,
    };
  }
}
