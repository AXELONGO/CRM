import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getPaymentsAuthorization,
  paymentsAuthorizationError,
} from "@/modules/payments/application/authorization";
import {
  getReceivablePlan,
  openReceivablePlan,
} from "@/modules/payments/infrastructure/repositories";

function serializePlanDetail(detail: {
  plan: { expectedTotalMinor: bigint; scheduledTotalMinor: bigint };
  installments: Array<{ amountMinor: bigint; paidAmountMinor: bigint }>;
}) {
  return {
    ...detail,
    plan: {
      ...detail.plan,
      expectedTotalMinor: detail.plan.expectedTotalMinor.toString(),
      scheduledTotalMinor: detail.plan.scheduledTotalMinor.toString(),
    },
    installments: detail.installments.map((installment) => ({
      ...installment,
      amountMinor: installment.amountMinor.toString(),
      paidAmountMinor: installment.paidAmountMinor.toString(),
    })),
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; planId: string }> },
) {
  try {
    const { tenantSlug, planId } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.read",
    );
    return NextResponse.json(
      serializePlanDetail(
        await withTenantDatabase(getDatabase(), context, (tx) =>
          getReceivablePlan(tx, context.tenant.id, planId),
        ),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar el plan de cobro." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; planId: string }> },
) {
  try {
    const { tenantSlug, planId } = await params;
    const { context } = await getPaymentsAuthorization(
      request,
      tenantSlug,
      "payments.create_plan",
    );
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, (tx) =>
        openReceivablePlan(tx, { tenantId: context.tenant.id, planId }),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo abrir el plan de cobro." },
      { status: paymentsAuthorizationError(error) },
    );
  }
}
