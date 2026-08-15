import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDatabase } from "@/infrastructure/database/client";
import { withTenantDatabase } from "@/infrastructure/database/tenant";
import { encryptIntegrationSecret } from "@/infrastructure/encryption/integration-secrets";
import {
  inboxConnections,
  inboxWebhookRoutes,
  integrationSecretValues,
} from "@/infrastructure/database/schema";
import {
  getCommercialAuthorization,
  salesAuthorizationError,
} from "@/modules/sales/application/authorization";
import { capabilities } from "@/modules/inbox/domain/canonical";

const schema = z.object({
  channel: z.enum([
    "whatsapp_meta",
    "whatsapp_waha",
    "web_form",
    "email",
    "meta_lead_ads",
    "messenger",
    "instagram",
  ]),
  name: z.string().trim().min(2).max(120),
  externalAccountId: z.string().max(200).nullable().optional(),
  externalIdentifiers: z.record(z.string(), z.string().max(200)).default({}),
  secrets: z.record(z.string(), z.string().min(1).max(5000)).default({}),
  webhookSecret: z.string().min(16).max(5000),
});
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "integrations.view",
    );
    const rows = await withTenantDatabase(getDatabase(), context, (tx) =>
      tx
        .select({
          id: inboxConnections.id,
          channel: inboxConnections.channel,
          name: inboxConnections.name,
          status: inboxConnections.status,
          externalAccountId: inboxConnections.externalAccountId,
          capabilities: inboxConnections.capabilities,
          lastVerifiedAt: inboxConnections.lastVerifiedAt,
          lastErrorCode: inboxConnections.lastErrorCode,
          version: inboxConnections.version,
        })
        .from(inboxConnections)
        .where(eq(inboxConnections.tenantId, context.tenant.id)),
    );
    return NextResponse.json({ connections: rows });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudieron cargar las conexiones." },
      { status: salesAuthorizationError(error) },
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await params;
    const { actor, context } = await getCommercialAuthorization(
      request,
      tenantSlug,
      "integrations.manage",
    );
    const input = schema.parse(await request.json());
    const publicKey =
      crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const created = await withTenantDatabase(getDatabase(), context, async (tx) => {
      const connectionId = crypto.randomUUID();
      const [connection] = await tx
        .insert(inboxConnections)
        .values({
          id: connectionId,
          tenantId: context.tenant.id,
          channel: input.channel,
          name: input.name,
          status: "configured",
          externalAccountId: input.externalAccountId ?? null,
          externalIdentifiers: input.externalIdentifiers,
          capabilities: {
            receiveText: capabilities[input.channel].receiveText,
            sendText: capabilities[input.channel].sendText,
            receiveAttachments: capabilities[input.channel].receiveAttachments,
            sendAttachments: capabilities[input.channel].sendAttachments,
            deliveryStatuses: capabilities[input.channel].deliveryStatuses,
            readStatuses: capabilities[input.channel].readStatuses,
            contextualReply: capabilities[input.channel].contextualReply,
            responseWindowHours: capabilities[input.channel].responseWindowHours,
            templatesRequiredOutsideWindow:
              capabilities[input.channel].templatesRequiredOutsideWindow,
            maxAttachmentBytes: capabilities[input.channel].maxAttachmentBytes,
            allowedMimeTypes: capabilities[input.channel].allowedMimeTypes,
          },
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
        })
        .returning();
      for (const [logicalName, value] of Object.entries(input.secrets)) {
        const encrypted = encryptIntegrationSecret(
          value,
          `secret/${context.tenant.id}/${connectionId}/${logicalName}`,
        );
        await tx.insert(integrationSecretValues).values({
          id: crypto.randomUUID(),
          tenantId: context.tenant.id,
          connectionId,
          logicalName,
          ...encrypted,
        });
      }
      const verifier = encryptIntegrationSecret(
        input.webhookSecret,
        `webhook/${context.tenant.id}/${connectionId}/verify`,
      );
      await tx.insert(inboxWebhookRoutes).values({
        id: crypto.randomUUID(),
        publicKeyHash: createHash("sha256").update(publicKey).digest("hex"),
        tenantId: context.tenant.id,
        connectionId,
        provider: input.channel,
        verifierCiphertext: verifier.ciphertext,
        verifierNonce: verifier.nonce,
        verifierAuthenticationTag: verifier.authenticationTag,
        verifierKeyVersion: verifier.keyVersion,
        active: false,
      });
      return connection;
    });
    return NextResponse.json(
      {
        connection: created,
        webhookUrl: `/api/webhooks/${input.channel}/${publicKey}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo configurar la conexión." },
      { status: salesAuthorizationError(error) },
    );
  }
}
