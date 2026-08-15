import { and, eq } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  integrationConnections,
  metaWhatsAppConfigs,
  tenantMessagingProviderSelections,
} from "@/infrastructure/database/schema";
import { buildMetaWebhookUrl } from "../domain/meta";
import { createHash } from "node:crypto";

export async function listIntegrationConnections(
  tx: TenantTransaction,
  tenantId: string,
) {
  return tx
    .select({ connection: integrationConnections, meta: metaWhatsAppConfigs })
    .from(integrationConnections)
    .leftJoin(
      metaWhatsAppConfigs,
      and(
        eq(metaWhatsAppConfigs.tenantId, integrationConnections.tenantId),
        eq(metaWhatsAppConfigs.connectionId, integrationConnections.id),
      ),
    )
    .where(eq(integrationConnections.tenantId, tenantId));
}
export async function createMetaWhatsAppConnection(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    userId: string;
    displayName: string;
    appId: string;
    wabaId: string;
    phoneNumberId: string;
    graphApiVersion: string;
    publicConnectionKey: string;
  },
) {
  const [connection] = await tx
    .insert(integrationConnections)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      providerCode: "meta_whatsapp_cloud",
      displayName: input.displayName.trim(),
      ownershipMode: "tenant_owned_app",
      status: "configuring",
      config: { graphApiVersion: input.graphApiVersion },
      createdByUserId: input.userId,
    })
    .returning();
  await tx.insert(metaWhatsAppConfigs).values({
    tenantId: input.tenantId,
    connectionId: connection.id,
    graphApiVersion: input.graphApiVersion,
    appId: input.appId,
    wabaId: input.wabaId,
    phoneNumberId: input.phoneNumberId,
    publicConnectionKeyHash: createHash("sha256")
      .update(input.publicConnectionKey)
      .digest("hex"),
  });
  return connection;
}
export async function selectWhatsAppConnection(
  tx: TenantTransaction,
  input: { tenantId: string; connectionId: string; userId: string },
) {
  const [connection] = await tx
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.tenantId, input.tenantId),
        eq(integrationConnections.id, input.connectionId),
        eq(integrationConnections.providerCode, "meta_whatsapp_cloud"),
        eq(integrationConnections.status, "verified"),
      ),
    )
    .limit(1);
  if (!connection) throw new Error("INTEGRATION_CONNECTION_NOT_VERIFIED");
  await tx
    .insert(tenantMessagingProviderSelections)
    .values({
      tenantId: input.tenantId,
      capability: "whatsapp_messaging",
      activeConnectionId: input.connectionId,
      state: "active",
      activatedByUserId: input.userId,
      activatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        tenantMessagingProviderSelections.tenantId,
        tenantMessagingProviderSelections.capability,
      ],
      set: {
        activeConnectionId: input.connectionId,
        state: "active",
        activatedByUserId: input.userId,
        activatedAt: new Date(),
        version: tenantMessagingProviderSelections.version,
      },
    });
  return connection;
}
export function webhookUrl(origin: string, publicConnectionKey: string) {
  return buildMetaWebhookUrl(origin, publicConnectionKey);
}
