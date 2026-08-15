import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { addInternalNote } from "@/modules/inbox/infrastructure/repositories";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; conversationId: string }> },
) {
  try {
    const { tenantSlug, conversationId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "inbox.notes.create",
    );
    const body = (await request.json()) as { bodyText: string };
    return NextResponse.json(
      {
        note: await withTenantDatabase(getDatabase(), context, (tx) =>
          addInternalNote(tx, {
            tenantId: context.tenant.id,
            conversationId,
            authorUserId: actor.userId,
            bodyText: body.bodyText,
          }),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo guardar la nota." },
      { status: salesAuthorizationError(error) },
    );
  }
}
