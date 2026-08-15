import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getEnvironment } from "@/infrastructure/config/env";
import { getIngressDatabase } from "@/infrastructure/database/client";
import {
  decryptIntegrationSecret,
  equalFingerprint,
} from "@/infrastructure/encryption/integration-secrets";
import {
  integrationJobs,
  inboxWebhookRoutes,
  webhookReceipts,
} from "@/infrastructure/database/schema";
import { MetaAdapter } from "@/modules/inbox/infrastructure/providers/meta/shared";
import { MetaLeadAdsAdapter } from "@/modules/inbox/infrastructure/providers/meta-leads/adapter";
import { WahaAdapter } from "@/modules/inbox/infrastructure/providers/waha/adapter";
import { WebFormAdapter } from "@/modules/inbox/infrastructure/providers/web-form/adapter";
import type { ChannelType } from "@/modules/inbox/domain/canonical";

function hashKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function adapterFor(provider: string) {
  if (provider === "whatsapp_meta") return new MetaAdapter("whatsapp_meta");
  if (provider === "whatsapp_waha") return new WahaAdapter();
  if (provider === "meta_lead_ads") return new MetaLeadAdsAdapter();
  if (provider === "web_form") return new WebFormAdapter();
  if (provider === "messenger") return new MetaAdapter("messenger");
  if (provider === "instagram") return new MetaAdapter("instagram");
  throw new Error("WEBHOOK_PROVIDER_UNSUPPORTED");
}

export async function verifyMetaChallenge(
  publicKey: string,
  mode: string | null,
  token: string | null,
  challenge: string | null,
) {
  if (mode !== "subscribe" || !challenge) throw new Error("WEBHOOK_CHALLENGE_INVALID");
  const db = getIngressDatabase();
  const [route] = await db
    .select()
    .from(inboxWebhookRoutes)
    .where(
      and(
        eq(inboxWebhookRoutes.publicKeyHash, hashKey(publicKey)),
        eq(inboxWebhookRoutes.active, true),
      ),
    )
    .limit(1);
  if (
    !route?.verifierCiphertext ||
    !route.verifierNonce ||
    !route.verifierAuthenticationTag ||
    !token
  )
    throw new Error("WEBHOOK_CHALLENGE_INVALID");
  const secret = decryptIntegrationSecret(
    {
      algorithm: "aes-256-gcm",
      ciphertext: route.verifierCiphertext,
      nonce: route.verifierNonce,
      authenticationTag: route.verifierAuthenticationTag,
      keyVersion: route.verifierKeyVersion ?? 1,
      fingerprint: "",
    },
    `webhook/${route.tenantId}/${route.connectionId}/verify`,
  );
  if (!equalFingerprint(hashKey(token), hashKey(secret)))
    throw new Error("WEBHOOK_CHALLENGE_INVALID");
  return challenge;
}

export async function acceptWebhook(
  publicKey: string,
  request: Request,
  channel: ChannelType,
) {
  const environment = getEnvironment();
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > environment.WEBHOOK_MAX_BODY_BYTES)
    throw new Error("WEBHOOK_BODY_TOO_LARGE");
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length > environment.WEBHOOK_MAX_BODY_BYTES)
    throw new Error("WEBHOOK_BODY_TOO_LARGE");
  const db = getIngressDatabase();
  const [route] = await db
    .select()
    .from(inboxWebhookRoutes)
    .where(
      and(
        eq(inboxWebhookRoutes.publicKeyHash, hashKey(publicKey)),
        eq(inboxWebhookRoutes.active, true),
      ),
    )
    .limit(1);
  if (!route) throw new Error("WEBHOOK_ROUTE_NOT_FOUND");
  if (route.provider !== channel) throw new Error("WEBHOOK_CHANNEL_MISMATCH");
  if (
    !route.verifierCiphertext ||
    !route.verifierNonce ||
    !route.verifierAuthenticationTag
  )
    throw new Error("WEBHOOK_VERIFIER_MISSING");
  const verifier = decryptIntegrationSecret(
    {
      algorithm: "aes-256-gcm",
      ciphertext: route.verifierCiphertext,
      nonce: route.verifierNonce,
      authenticationTag: route.verifierAuthenticationTag,
      keyVersion: route.verifierKeyVersion ?? 1,
      fingerprint: "",
    },
    `webhook/${route.tenantId}/${route.connectionId}/verify`,
  );
  const adapter = adapterFor(channel);
  const verification = await adapter.verifyWebhook(raw, request.headers, {
    id: route.connectionId,
    channel,
    externalIdentifiers: {},
    secrets:
      channel === "whatsapp_waha"
        ? { hmacKey: verifier }
        : { appSecret: verifier, signingKey: verifier },
  });
  if (!verification.valid) throw new Error("WEBHOOK_SIGNATURE_INVALID");
  const bodyHash = createHash("sha256").update(raw).digest("hex");
  const encrypted = (
    await import("@/infrastructure/encryption/integration-secrets")
  ).encryptIntegrationSecret(
    raw.toString("base64"),
    `receipt/${route.tenantId}/${route.connectionId}/${bodyHash}`,
  );
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${route.tenantId}, true)`,
    );
    const [receipt] = await tx
      .insert(webhookReceipts)
      .values({
        id: crypto.randomUUID(),
        tenantId: route.tenantId,
        connectionId: route.connectionId,
        externalEventId:
          "externalEventId" in verification &&
          typeof verification.externalEventId === "string"
            ? verification.externalEventId
            : null,
        bodyCiphertext: encrypted.ciphertext,
        bodyNonce: encrypted.nonce,
        bodyAuthenticationTag: encrypted.authenticationTag,
        bodyHash,
        keyVersion: encrypted.keyVersion,
        contentType: request.headers.get("content-type") ?? "application/json",
        bodySize: raw.length,
        status: "queued",
        expiresAt: new Date(
          Date.now() + environment.INBOUND_RECEIPT_RETENTION_DAYS * 86_400_000,
        ),
      })
      .onConflictDoNothing()
      .returning();
    if (receipt)
      await tx
        .insert(integrationJobs)
        .values({
          id: crypto.randomUUID(),
          tenantId: route.tenantId,
          connectionId: route.connectionId,
          receiptId: receipt.id,
          type: "process_webhook",
          idempotencyKey: `receipt:${route.connectionId}:${bodyHash}`,
        })
        .onConflictDoNothing();
  });
  return { accepted: true };
}
