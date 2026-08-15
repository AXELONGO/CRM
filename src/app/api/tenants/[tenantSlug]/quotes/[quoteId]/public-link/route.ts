import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { createQuotePublicLink } from "@/modules/quotes/infrastructure/repositories";

const bodySchema = z.object({ expiresAt: z.coerce.date().nullable().optional() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; quoteId: string }> },
) {
  try {
    const { tenantSlug, quoteId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "quotes.send",
    );
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const token = await withTenantDatabase(getDatabase(), context, (tx) =>
      createQuotePublicLink(tx, {
        tenantId: context.tenant.id,
        quoteId,
        actorUserId: actor.userId,
        expiresAt: body.expiresAt,
      }),
    );
    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo crear el enlace público." },
      { status: salesAuthorizationError(error) },
    );
  }
}
