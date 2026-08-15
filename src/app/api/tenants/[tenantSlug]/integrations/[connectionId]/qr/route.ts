import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { wahaSessionBindings } from "@/infrastructure/database/schema";
import { and, eq } from "drizzle-orm";
import { FakeWahaServer } from "@/modules/integrations/infrastructure/fake-waha";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; connectionId: string }> },
) {
  try {
    const { tenantSlug, connectionId } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "integrations.manage",
    );
    const allowed = await withTenantDatabase(getDatabase(), context, async (tx) => {
      const [binding] = await tx
        .select()
        .from(wahaSessionBindings)
        .where(
          and(
            eq(wahaSessionBindings.tenantId, context.tenant.id),
            eq(wahaSessionBindings.connectionId, connectionId),
          ),
        )
        .limit(1);
      return binding?.state === "qr_required";
    });
    if (!allowed)
      return NextResponse.json({ error: "El QR no está disponible." }, { status: 409 });
    const qr = await new FakeWahaServer().getQr();
    return new Response(qr.bytes, {
      status: 200,
      headers: {
        "content-type": qr.contentType,
        "cache-control": "no-store, no-cache",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo obtener el QR." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
