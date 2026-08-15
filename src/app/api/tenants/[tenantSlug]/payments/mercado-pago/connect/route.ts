import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { beginMercadoPagoAuthorization } from "@/modules/payments/infrastructure/mercado-pago-repositories";
import { getEnvironment } from "@/infrastructure/config/env";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { actor, context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "integrations.mercado_pago.connect",
    );
    const env = getEnvironment();
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      beginMercadoPagoAuthorization(tx, {
        tenantId: context.tenant.id,
        userId: actor.userId,
        clientId: env.MERCADO_PAGO_OAUTH_CLIENT_ID,
        redirectUri: env.MERCADO_PAGO_OAUTH_REDIRECT_URI,
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
      { error: "No se pudo iniciar la autorización de Mercado Pago." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
