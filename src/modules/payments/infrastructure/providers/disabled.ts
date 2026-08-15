import type {
  HostedCheckout,
  HostedCheckoutCommand,
  HostedCheckoutPort,
  PaymentProvider,
} from "../../application/ports/hosted-checkout";

export class DisabledPaymentProviderAdapter implements HostedCheckoutPort {
  constructor(private readonly provider: Exclude<PaymentProvider, "fake">) {}

  getCapabilities() {
    return {
      hostedCheckout: false,
      authoritativeFetch: false,
      webhookVerification: false,
      expiry: false,
    };
  }

  async createCheckout(_: HostedCheckoutCommand): Promise<HostedCheckout> {
    throw new Error(`PAYMENT_PROVIDER_${this.provider.toUpperCase()}_DISABLED`);
  }

  async fetchPayment(_: string): Promise<{
    status: "pending" | "confirmed" | "failed";
    amountMinor: bigint;
    currency: string;
    externalPaymentId: string;
  }> {
    throw new Error(`PAYMENT_PROVIDER_${this.provider.toUpperCase()}_DISABLED`);
  }
}

export const disabledProviderAdapters = {
  stripe: new DisabledPaymentProviderAdapter("stripe"),
  mercadopago: new DisabledPaymentProviderAdapter("mercadopago"),
  paypal: new DisabledPaymentProviderAdapter("paypal"),
};
