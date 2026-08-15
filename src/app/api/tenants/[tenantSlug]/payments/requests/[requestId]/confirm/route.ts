import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { confirmFakePayment } from "@/modules/payments/infrastructure/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; requestId: string }> },
) {
  try {
    const { tenantSlug, requestId } = await params;
    const { actor, context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.record_manual",
    );
    const payment = await withTenantDatabase(getDatabase(), context, (tx) =>
      confirmFakePayment(tx, {
        tenantId: context.tenant.id,
        requestId,
        actorUserId: actor.userId,
      }),
    );
    return NextResponse.json({ payment: { id: payment.id, status: payment.status } });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo confirmar el pago sandbox." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
