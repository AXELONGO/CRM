import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { reviewManualPayment } from "@/modules/payments/infrastructure/repositories";

const schema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; submissionId: string }> },
) {
  try {
    const { tenantSlug, submissionId } = await params;
    const { actor, context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.review_manual",
    );
    const input = schema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      reviewManualPayment(tx, {
        tenantId: context.tenant.id,
        submissionId,
        reviewerMembershipId: context.membership.id,
        reviewerUserId: actor.userId,
        ...input,
      }),
    );
    return NextResponse.json({ status: result.status, repeated: result.repeated });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo revisar el pago manual." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
