import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { issueAgreement } from "@/modules/agreements/infrastructure/repositories";

const bodySchema = z.object({
  method: z.enum(["internal_electronic_acceptance", "external_signed_pdf"]),
  signingOrder: z.enum(["provider_first", "customer_first", "parallel"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; agreementId: string }> },
) {
  try {
    const { tenantSlug, agreementId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "agreements.issue",
    );
    const body = bodySchema.parse(await request.json());
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      issueAgreement(tx, {
        ...body,
        tenantId: context.tenant.id,
        agreementId,
        actorUserId: actor.userId,
      }),
    );
    return NextResponse.json({ agreement: result });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo emitir el acuerdo." },
      { status: salesAuthorizationError(error) },
    );
  }
}
