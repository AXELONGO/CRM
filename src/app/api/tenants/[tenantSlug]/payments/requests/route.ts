import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { createFakePaymentRequest } from "@/modules/payments/infrastructure/repositories";

const schema = z.object({
  planId: z.string(),
  installmentId: z.string(),
  idempotencyKey: z.string().min(16).max(120),
  provider: z.enum(["fake", "mercadopago", "stripe", "paypal"]).default("fake"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.create_request",
    );
    const body = schema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      createFakePaymentRequest(tx, {
        tenantId: context.tenant.id,
        membershipId: context.membership.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        ...body,
      }),
    );
    return NextResponse.json(result, { status: result.repeated ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear la liga de pago." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
