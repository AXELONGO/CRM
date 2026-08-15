import { and, eq } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  integrationConnections,
  tenantMessagingProviderSelections,
  wahaInstances,
  wahaSessionBindings,
} from "@/infrastructure/database/schema";
import { createOpaqueSessionName, hashPublicConnectionKey } from "../domain/waha";

export async function listWahaSessions(tx: TenantTransaction, tenantId: string) {
  return tx
    .select({ binding: wahaSessionBindings, connection: integrationConnections })
    .from(wahaSessionBindings)
    .innerJoin(
      integrationConnections,
      and(
        eq(integrationConnections.tenantId, wahaSessionBindings.tenantId),
        eq(integrationConnections.id, wahaSessionBindings.connectionId),
      ),
    )
    .where(eq(wahaSessionBindings.tenantId, tenantId));
}

export async function provisionFakeWahaSession(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    userId: string;
    displayName: string;
    riskAccepted: boolean;
  },
) {
  if (!input.riskAccepted) throw new Error("WAHA_RISK_ACCEPTANCE_REQUIRED");
  const [instance] = await tx
    .select()
    .from(wahaInstances)
    .where(eq(wahaInstances.status, "healthy"))
    .limit(1);
  if (!instance) throw new Error("WAHA_INSTANCE_UNAVAILABLE");
  const connectionId = crypto.randomUUID();
  const publicKey = `fake_waha_${crypto.randomUUID().replaceAll("-", "")}`;
  const [connection] = await tx
    .insert(integrationConnections)
    .values({
      id: connectionId,
      tenantId: input.tenantId,
      providerCode: "waha",
      displayName: input.displayName.trim(),
      ownershipMode: "platform_managed_session",
      status: "configuring",
      capabilities: { simulated: true },
      config: { engine: instance.engine, environment: "test" },
      createdByUserId: input.userId,
    })
    .returning();
  const [binding] = await tx
    .insert(wahaSessionBindings)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      connectionId,
      instanceId: instance.id,
      sessionName: createOpaqueSessionName(),
      engine: instance.engine,
      state: "stopped",
      sessionKeyRef: `waha/${input.tenantId}/${connectionId}/session`,
      mediaKeyRef: `waha/${input.tenantId}/${connectionId}/media`,
      webhookHmacSecretRef: `waha/${input.tenantId}/${connectionId}/webhook`,
      publicConnectionKeyHash: hashPublicConnectionKey(publicKey),
      riskAcceptedAt: new Date(),
    })
    .returning();
  return {
    connection,
    binding,
    publicConnectionKey: publicKey,
    instance: {
      id: instance.id,
      engine: instance.engine,
      imageVersion: instance.imageVersion,
    },
  };
}

export async function findWahaBindingByPublicKey(
  tx: TenantTransaction,
  publicKey: string,
) {
  const [binding] = await tx
    .select()
    .from(wahaSessionBindings)
    .where(
      eq(
        wahaSessionBindings.publicConnectionKeyHash,
        hashPublicConnectionKey(publicKey),
      ),
    )
    .limit(1);
  return binding;
}

export async function updateWahaSessionState(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    connectionId: string;
    state:
      | "starting"
      | "qr_required"
      | "working"
      | "stopped"
      | "stopping"
      | "logged_out"
      | "revoked";
    expectedVersion?: number;
  },
) {
  const [binding] = await tx
    .update(wahaSessionBindings)
    .set({
      state: input.state,
      version: wahaSessionBindings.version,
      updatedAt: new Date(),
      lastEventAt: new Date(),
      ...(input.state === "starting" ? { startedAt: new Date() } : {}),
      ...(input.state === "working"
        ? { workingAt: new Date(), authenticatedAt: new Date() }
        : {}),
      ...(input.state === "stopped" ? { stoppedAt: new Date() } : {}),
      ...(input.state === "logged_out" ? { loggedOutAt: new Date() } : {}),
    })
    .where(
      and(
        eq(wahaSessionBindings.tenantId, input.tenantId),
        eq(wahaSessionBindings.connectionId, input.connectionId),
        ...(input.expectedVersion === undefined
          ? []
          : [eq(wahaSessionBindings.version, input.expectedVersion)]),
      ),
    )
    .returning();
  if (!binding) throw new Error("WAHA_SESSION_VERSION_CONFLICT");
  return binding;
}

export async function selectWahaConnection(
  tx: TenantTransaction,
  input: { tenantId: string; connectionId: string; userId: string },
) {
  const [binding] = await tx
    .select()
    .from(wahaSessionBindings)
    .where(
      and(
        eq(wahaSessionBindings.tenantId, input.tenantId),
        eq(wahaSessionBindings.connectionId, input.connectionId),
        eq(wahaSessionBindings.state, "working"),
      ),
    )
    .limit(1);
  if (!binding) throw new Error("WAHA_SESSION_NOT_WORKING");
  await tx
    .update(integrationConnections)
    .set({ status: "active", activatedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(integrationConnections.tenantId, input.tenantId),
        eq(integrationConnections.id, input.connectionId),
      ),
    );
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
      },
    });
  return binding;
}
