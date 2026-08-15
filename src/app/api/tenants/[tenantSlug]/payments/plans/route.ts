import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import {
  createReceivablePlanFromAcceptedQuote,
  createReceivablePlanFromExecutedAgreement,
  listReceivablePlans,
} from "@/modules/payments/infrastructure/repositories";

const createSchema = z.object({
  sourceKind: z
    .enum(["accepted_quote", "executed_agreement"])
    .default("accepted_quote"),
  sourceId: z.string().min(1),
});

function serializePlanRow(row: {
  expectedTotalMinor: bigint;
  scheduledTotalMinor: bigint;
  [key: string]: unknown;
}) {
  return {
    ...row,
    expectedTotalMinor: row.expectedTotalMinor.toString(),
    scheduledTotalMinor: row.scheduledTotalMinor.toString(),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.read",
    );
    return NextResponse.json({
      plans: (
        await withTenantDatabase(getDatabase(), context, (tx) =>
          listReceivablePlans(tx, context.tenant.id),
        )
      ).map(serializePlanRow),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las cuentas por cobrar." },
      { status: paymentsAuthorizationError(error) },
    );
  }
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
      "payments.create_plan",
    );
    const body = createSchema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      body.sourceKind === "executed_agreement"
        ? createReceivablePlanFromExecutedAgreement(tx, {
            tenantId: context.tenant.id,
            agreementId: body.sourceId,
            membershipId: context.membership.id,
          })
        : createReceivablePlanFromAcceptedQuote(tx, {
            tenantId: context.tenant.id,
            quoteId: body.sourceId,
            membershipId: context.membership.id,
          }),
    );
    return NextResponse.json(result, { status: result.repeated ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear el plan de cobro." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
