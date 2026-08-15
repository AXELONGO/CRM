import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  reviewAgreement,
  submitAgreementReview,
} from "@/modules/agreements/infrastructure/repositories";

const schema = z.object({
  decision: z.enum(["submit", "approved", "rejected"]),
  area: z.enum(["commercial", "legal_internal", "finance"]).default("commercial"),
  comment: z.string().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; agreementId: string }> },
) {
  try {
    const { tenantSlug, agreementId } = await params;
    const body = schema.parse(await request.json());
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      body.decision === "submit" ? "agreements.submit_review" : "agreements.review",
    );
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      body.decision === "submit"
        ? submitAgreementReview(tx, {
            tenantId: context.tenant.id,
            agreementId,
            userId: actor.userId,
          })
        : reviewAgreement(tx, {
            tenantId: context.tenant.id,
            agreementId,
            userId: actor.userId,
            decision: body.decision,
            area: body.area,
            comment: body.comment,
          }),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo actualizar la revisión." },
      { status: salesAuthorizationError(error) },
    );
  }
}
