import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import {
  getConversation,
  updateConversationStatus,
} from "@/modules/inbox/infrastructure/repositories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; conversationId: string }> },
) {
  try {
    const { tenantSlug, conversationId } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "inbox.view",
    );
    return NextResponse.json(
      await withTenantDatabase(getDatabase(), context, (tx) =>
        getConversation(tx, context.tenant.id, conversationId),
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cargar la conversación." },
      { status: salesAuthorizationError(error) },
    );
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; conversationId: string }> },
) {
  try {
    const { tenantSlug, conversationId } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "inbox.status.manage",
    );
    const body = (await request.json()) as {
      status: "open" | "pending" | "closed" | "spam";
    };
    return NextResponse.json({
      conversation: await withTenantDatabase(getDatabase(), context, (tx) =>
        updateConversationStatus(tx, {
          tenantId: context.tenant.id,
          conversationId,
          status: body.status,
        }),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cambiar el estado." },
      { status: salesAuthorizationError(error) },
    );
  }
}
