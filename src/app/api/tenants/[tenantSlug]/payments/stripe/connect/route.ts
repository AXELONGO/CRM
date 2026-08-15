import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { getEnvironment } from "@/infrastructure/config/env";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { beginStripeAuthorization } from "@/modules/payments/infrastructure/stripe-repositories";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { actor, context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "integrations.stripe.connect",
    );
    const env = getEnvironment();
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      beginStripeAuthorization(tx, {
        tenantId: context.tenant.id,
        userId: actor.userId,
        clientId: env.STRIPE_CONNECT_CLIENT_ID,
        redirectUri: env.STRIPE_CONNECT_REDIRECT_URI,
      }),
    );
    return NextResponse.json(
      {
        authorizationUrl: result.authorizationUrl,
        connectionId: result.connection.id,
        mode: "test_only",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo iniciar la conexión Stripe." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
