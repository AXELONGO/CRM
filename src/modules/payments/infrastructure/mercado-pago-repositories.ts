import { and, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import { encryptIntegrationSecret } from "@/infrastructure/encryption/integration-secrets";
import {
  mercadoPagoProfiles,
  oauthAuthorizationAttempts,
  paymentConnections,
  paymentSecretValues,
} from "@/infrastructure/database/schema";
import {
  createOAuthState,
  equalOAuthState,
  hashOAuthState,
  maskMercadoPagoEmail,
  mercadoPagoOAuthUrl,
} from "../domain/mercado-pago";

export async function beginMercadoPagoAuthorization(
  tx: TenantTransaction,
  input: { tenantId: string; userId: string; redirectUri: string; clientId: string },
) {
  let [connection] = await tx
    .select()
    .from(paymentConnections)
    .where(
      and(
        eq(paymentConnections.tenantId, input.tenantId),
        eq(paymentConnections.provider, "mercadopago"),
      ),
    )
    .limit(1);
  if (!connection)
    [connection] = await tx
      .insert(paymentConnections)
      .values({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        provider: "mercadopago",
        environment: "sandbox",
        displayName: "Mercado Pago",
        capabilities: {
          oauthConnect: true,
          hostedCheckout: true,
          reconciliation: true,
        },
        status: "authorization_pending",
      })
      .returning();
  const state = createOAuthState();
  await tx.insert(oauthAuthorizationAttempts).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    provider: "mercadopago",
    connectionId: connection.id,
    initiatedByUserId: input.userId,
    stateHash: hashOAuthState(state),
    redirectUriVersion: "v1",
    requestedScopes: ["offline_access", "read", "write"],
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  return {
    connection,
    authorizationUrl: mercadoPagoOAuthUrl(input.clientId, input.redirectUri, state),
  };
}

export async function consumeMercadoPagoAuthorization(
  tx: TenantTransaction,
  input: { state: string; userId: string },
) {
  const [attempt] = await tx
    .select()
    .from(oauthAuthorizationAttempts)
    .where(
      and(
        eq(oauthAuthorizationAttempts.stateHash, hashOAuthState(input.state)),
        isNull(oauthAuthorizationAttempts.consumedAt),
      ),
    )
    .for("update")
    .limit(1);
  if (
    !attempt ||
    attempt.expiresAt <= new Date() ||
    !equalOAuthState(input.state, attempt.stateHash) ||
    attempt.initiatedByUserId !== input.userId
  )
    throw new Error("MERCADO_PAGO_OAUTH_ATTEMPT_INVALID");
  await tx
    .update(oauthAuthorizationAttempts)
    .set({ consumedAt: new Date(), result: "succeeded" })
    .where(eq(oauthAuthorizationAttempts.id, attempt.id));
  return attempt;
}

export async function storeMercadoPagoTokens(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    connectionId: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    sellerUserId: string;
    nickname: string;
    email: string;
    countryCode: string;
    siteId: string;
    scopes: string[];
  },
) {
  const access = encryptIntegrationSecret(
    input.accessToken,
    `payment/${input.tenantId}/${input.connectionId}/access_token`,
  );
  const refresh = encryptIntegrationSecret(
    input.refreshToken,
    `payment/${input.tenantId}/${input.connectionId}/refresh_token`,
  );
  for (const [logicalName, secret] of [
    ["access_token", access],
    ["refresh_token", refresh],
  ] as const)
    await tx
      .insert(paymentSecretValues)
      .values({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        connectionId: input.connectionId,
        logicalName,
        ...secret,
      })
      .onConflictDoUpdate({
        target: [
          paymentSecretValues.tenantId,
          paymentSecretValues.connectionId,
          paymentSecretValues.logicalName,
        ],
        set: { ...secret, updatedAt: new Date() },
      });
  await tx
    .insert(mercadoPagoProfiles)
    .values({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      environment: "fake",
      sellerUserId: input.sellerUserId,
      nicknameMasked: input.nickname,
      emailMasked: maskMercadoPagoEmail(input.email),
      countryCode: input.countryCode,
      siteId: input.siteId,
      scopes: input.scopes,
      status: "connected",
      accessTokenSecretRef: `payment/${input.tenantId}/${input.connectionId}/access_token`,
      refreshTokenSecretRef: `payment/${input.tenantId}/${input.connectionId}/refresh_token`,
      accessTokenExpiresAt: new Date(Date.now() + input.expiresIn * 1000),
      authorizedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [mercadoPagoProfiles.tenantId, mercadoPagoProfiles.connectionId],
      set: {
        sellerUserId: input.sellerUserId,
        nicknameMasked: input.nickname,
        emailMasked: maskMercadoPagoEmail(input.email),
        status: "connected",
        accessTokenSecretRef: `payment/${input.tenantId}/${input.connectionId}/access_token`,
        refreshTokenSecretRef: `payment/${input.tenantId}/${input.connectionId}/refresh_token`,
        accessTokenExpiresAt: new Date(Date.now() + input.expiresIn * 1000),
        tokenVersion: mercadoPagoProfiles.tokenVersion,
        updatedAt: new Date(),
      },
    });
  await tx
    .update(paymentConnections)
    .set({
      status: "active",
      externalAccountId: input.sellerUserId,
      externalAccountDisplay: input.nickname,
      secretReference: `payment/${input.tenantId}/${input.connectionId}`,
      connectedByMembershipId: input.userId,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentConnections.tenantId, input.tenantId),
        eq(paymentConnections.id, input.connectionId),
      ),
    );
}

export function mercadoPagoExternalReference(requestId: string) {
  return `mp_${createHash("sha256").update(requestId).digest("hex").slice(0, 32)}`;
}
