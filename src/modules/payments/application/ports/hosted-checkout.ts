export type PaymentProvider = "stripe" | "mercadopago" | "paypal" | "fake";

export type HostedCheckoutCommand = {
  tenantId: string;
  connectionId: string;
  paymentRequestId: string;
  idempotencyKey: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  externalReference: string;
  successUrl: string;
  cancelUrl: string;
  expiresAt?: Date;
};

export type HostedCheckout = {
  externalCheckoutId: string;
  hostedUrl: string;
  status: "open" | "expired";
  expiresAt?: Date;
  providerRequestId: string;
  rawDigest: string;
};

export interface HostedCheckoutPort {
  getCapabilities?(): {
    hostedCheckout: boolean;
    authoritativeFetch: boolean;
    webhookVerification: boolean;
    expiry: boolean;
  };
  createCheckout(command: HostedCheckoutCommand): Promise<HostedCheckout>;
  fetchPayment(externalPaymentId: string): Promise<{
    status: "pending" | "confirmed" | "failed";
    amountMinor: bigint;
    currency: string;
    externalPaymentId: string;
  }>;
}
