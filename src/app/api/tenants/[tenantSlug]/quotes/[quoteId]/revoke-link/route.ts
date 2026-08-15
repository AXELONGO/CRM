import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { revokeQuotePublicLink } from "@/modules/quotes/infrastructure/repositories";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; quoteId: string }> },
) {
  try {
    const { tenantSlug, quoteId } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "quotes.revoke_link",
    );
    const result = await withTenantDatabase(getDatabase(), context, (tx) =>
      revokeQuotePublicLink(tx, { tenantId: context.tenant.id, quoteId }),
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo revocar el enlace." },
      { status: salesAuthorizationError(error) },
    );
  }
}
