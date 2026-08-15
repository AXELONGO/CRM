import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { recordPaymentAdjustment } from "@/modules/payments/infrastructure/repositories";

const schema = z.object({
  kind: z.enum([
    "partial_refund",
    "full_refund",
    "chargeback",
    "reversal",
    "correction",
  ]),
  amountMinor: z.string().regex(/^[1-9][0-9]*$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  reason: z.string().min(1).max(500),
  externalAdjustmentId: z.string().max(120).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; paymentId: string }> },
) {
  try {
    const { tenantSlug, paymentId } = await params;
    const { actor, context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.reverse_manual",
    );
    const input = schema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      recordPaymentAdjustment(tx, {
        ...input,
        tenantId: context.tenant.id,
        paymentId,
        amountMinor: BigInt(input.amountMinor),
        createdByUserId: actor.userId,
      }),
    );
    return NextResponse.json(result, { status: result.repeated ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo registrar el ajuste." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
