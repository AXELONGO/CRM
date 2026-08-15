import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { inboxConnections, inboxWebhookRoutes } from "@/infrastructure/database/schema";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; connectionId: string }> },
) {
  try {
    const { tenantSlug, connectionId } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "integrations.manage",
    );
    const body = (await request.json()) as {
      status?: "active" | "disabled" | "configured";
      version?: number;
    };
    if (!body.status || body.version === undefined)
      throw new Error("INTEGRATION_STATUS_REQUIRED");
    const version = body.version;
    const result = await withTenantDatabase(getDatabase(), context, async (tx) => {
      const [connection] = await tx
        .update(inboxConnections)
        .set({
          status: body.status,
          updatedAt: new Date(),
          updatedByUserId: actor.userId,
          version: sql`${inboxConnections.version} + 1`,
        })
        .where(
          and(
            eq(inboxConnections.tenantId, context.tenant.id),
            eq(inboxConnections.id, connectionId),
            eq(inboxConnections.version, version),
          ),
        )
        .returning();
      if (!connection) throw new Error("INTEGRATION_CONFLICT");
      await tx
        .update(inboxWebhookRoutes)
        .set({ active: body.status === "active" })
        .where(
          and(
            eq(inboxWebhookRoutes.tenantId, context.tenant.id),
            eq(inboxWebhookRoutes.connectionId, connectionId),
          ),
        );
      return connection;
    });
    return NextResponse.json({ connection: result });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cambiar el estado de la conexión." },
      { status: salesAuthorizationError(error) },
    );
  }
}
