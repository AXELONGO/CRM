import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import { submitManualPayment } from "@/modules/payments/infrastructure/repositories";

const schema = z.object({
  planId: z.string().min(1),
  installmentId: z.string().min(1).optional(),
  amountMinor: z.string().regex(/^[1-9][0-9]*$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  paidAt: z.string().datetime(),
  method: z.enum(["manual_transfer", "cash", "check"]),
  idempotencyKey: z.string().min(16).max(120),
  referenceMasked: z.string().max(80).optional(),
  institution: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
  evidenceKey: z.string().max(240).optional(),
});

function serializeSubmission(submission: { amountMinor: bigint; [key: string]: unknown }) {
  return { ...submission, amountMinor: submission.amountMinor.toString() };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.record_manual",
    );
    const input = schema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      submitManualPayment(tx, {
        ...input,
        tenantId: context.tenant.id,
        membershipId: context.membership.id,
        amountMinor: BigInt(input.amountMinor),
        paidAt: new Date(input.paidAt),
      }),
    );
    return NextResponse.json(
      {
        submission: serializeSubmission(result.submission),
        repeated: result.repeated,
      },
      { status: result.repeated ? 200 : 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo registrar el pago manual." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
