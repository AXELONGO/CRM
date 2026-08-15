import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  issueQuote,
  issueQuotePdf,
} from "@/modules/quotes/infrastructure/repositories";

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
    const quote = await withTenantDatabase(getDatabase(), context, async (tx) => {
      const issued = await issueQuote(tx, {
        tenantId: context.tenant.id,
        quoteId,
        actorUserId: actor.userId,
      });
      const pdf = await issueQuotePdf(tx, {
        tenantId: context.tenant.id,
        quoteId,
        actorUserId: actor.userId,
      });
      return { issued, pdf };
    });
    return NextResponse.json({ quote });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo emitir la cotización." },
      { status: salesAuthorizationError(error) },
    );
  }
}
