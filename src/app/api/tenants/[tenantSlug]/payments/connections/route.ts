import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { paymentConnections } from "@/infrastructure/database/schema";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.manage_connections",
    );
    const [connection] = await withTenantDatabase(getDatabase(), context, (tx) =>
      tx
        .insert(paymentConnections)
        .values({
          id: crypto.randomUUID(),
          tenantId: context.tenant.id,
          provider: "fake",
          environment: "sandbox",
          displayName: "Fake Checkout Sandbox",
          externalAccountDisplay: "sandbox",
          capabilities: {
            hostedCheckout: true,
            fixedAmount: true,
            fetchPayment: true,
            signedWebhooks: true,
            supportedCurrencies: ["MXN", "USD"],
          },
          status: "active",
        })
        .returning(),
    );
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo activar la conexión sandbox." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
