import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { issueQuotePdf } from "@/modules/quotes/infrastructure/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; quoteId: string }> },
) {
  try {
    const { tenantSlug, quoteId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "quotes.issue",
    );
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      issueQuotePdf(tx, {
        tenantId: context.tenant.id,
        quoteId,
        actorUserId: actor.userId,
      }),
    );
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo generar el PDF." },
      { status: salesAuthorizationError(error) },
    );
  }
}
