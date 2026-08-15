import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { assignConversation } from "@/modules/inbox/infrastructure/repositories";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; conversationId: string }> },
) {
  try {
    const { tenantSlug, conversationId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "inbox.assign",
    );
    const body = (await request.json()) as {
      membershipId: string | null;
      reason?: string;
    };
    return NextResponse.json({
      conversation: await withTenantDatabase(getDatabase(), context, (tx) =>
        assignConversation(tx, {
          tenantId: context.tenant.id,
          conversationId,
          actorUserId: actor.userId,
          membershipId: body.membershipId,
          reason: body.reason,
        }),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo asignar la conversación." },
      { status: salesAuthorizationError(error) },
    );
  }
}
