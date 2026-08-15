import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { beginPayPalOnboarding } from "@/modules/payments/infrastructure/paypal-repositories";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "integrations.paypal.connect",
    );
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      beginPayPalOnboarding(tx, { tenantId: context.tenant.id }),
    );
    return NextResponse.json(
      {
        actionUrl: result.actionUrl,
        connectionId: result.connection.id,
        mode: "test_only",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo iniciar onboarding PayPal." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
