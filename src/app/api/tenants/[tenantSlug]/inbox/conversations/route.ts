import { NextResponse } from "next/server";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { listConversations } from "@/modules/inbox/infrastructure/repositories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "inbox.view",
    );
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as
      "open" | "pending" | "closed" | "spam" | null;
    const channel = url.searchParams.get("channel") as Parameters<
      typeof listConversations
    >[1]["channel"];
    const conversations = await withTenantDatabase(getDatabase(), context, (tx) =>
      listConversations(tx, {
        tenantId: context.tenant.id,
        status: status ?? undefined,
        channel: channel ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 50),
      }),
    );
    return NextResponse.json({ conversations });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las conversaciones." },
      { status: salesAuthorizationError(error) },
    );
  }
}
