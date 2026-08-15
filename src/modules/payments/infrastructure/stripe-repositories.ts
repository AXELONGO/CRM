import { and, eq, isNull } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  oauthAuthorizationAttempts,
  paymentConnections,
  stripeProfiles,
} from "@/infrastructure/database/schema";
import {
  createStripeOAuthState,
  equalStripeOAuthState,
  hashStripeOAuthState,
  stripeOAuthUrl,
} from "../domain/stripe";

export async function beginStripeAuthorization(
  tx: TenantTransaction,
  input: { tenantId: string; userId: string; clientId: string; redirectUri: string },
) {
  let [connection] = await tx
    .select()
    .from(paymentConnections)
    .where(
      and(
        eq(paymentConnections.tenantId, input.tenantId),
        eq(paymentConnections.provider, "stripe"),
      ),
    )
    .limit(1);
  if (!connection)
    [connection] = await tx
      .insert(paymentConnections)
      .values({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        provider: "stripe",
        environment: "sandbox",
        displayName: "Stripe",
        capabilities: {
          standardOauth: true,
          directCharges: true,
          hostedCheckout: true,
          connectWebhooks: true,
        },
        status: "authorization_pending",
      })
      .returning();
  const state = createStripeOAuthState();
  await tx.insert(oauthAuthorizationAttempts).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    provider: "stripe",
    connectionId: connection.id,
    initiatedByUserId: input.userId,
    stateHash: hashStripeOAuthState(state),
    redirectUriVersion: "stripe-v1",
    requestedScopes: ["read_write"],
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  return {
    connection,
    authorizationUrl: stripeOAuthUrl(input.clientId, input.redirectUri, state),
  };
}

export async function consumeStripeAuthorization(
  tx: TenantTransaction,
  input: { state: string; userId: string },
) {
  const [attempt] = await tx
    .select()
    .from(oauthAuthorizationAttempts)
    .where(
      and(
        eq(oauthAuthorizationAttempts.stateHash, hashStripeOAuthState(input.state)),
        eq(oauthAuthorizationAttempts.provider, "stripe"),
        isNull(oauthAuthorizationAttempts.consumedAt),
      ),
    )
    .for("update")
    .limit(1);
  if (
    !attempt ||
    attempt.expiresAt <= new Date() ||
    !equalStripeOAuthState(input.state, attempt.stateHash) ||
    attempt.initiatedByUserId !== input.userId
  )
    throw new Error("STRIPE_OAUTH_ATTEMPT_INVALID");
  await tx
    .update(oauthAuthorizationAttempts)
    .set({ consumedAt: new Date(), result: "succeeded" })
    .where(eq(oauthAuthorizationAttempts.id, attempt.id));
  return attempt;
}

export async function saveStripeAccount(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    connectionId: string;
    stripeUserId: string;
    scope: string;
  },
) {
  const account = (await import("./providers/stripe")).fakeStripeServer.getAccount(
    input.stripeUserId,
  );
  if (!account.chargesEnabled || !account.payoutsEnabled || account.type !== "standard")
    throw new Error("STRIPE_ACCOUNT_NOT_READY");
  await tx
    .insert(stripeProfiles)
    .values({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      environment: "fake",
      stripeAccountId: account.id,
      oauthScope: input.scope,
      country: account.country,
      defaultCurrency: account.defaultCurrency,
      businessNameMasked: account.businessName,
      detailsSubmitted: account.detailsSubmitted,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      cardPaymentsCapability: account.cardPayments,
      requirementsSummary: account.requirements,
      status: "connected",
      connectedAt: new Date(),
      lastAccountSyncAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [stripeProfiles.tenantId, stripeProfiles.connectionId],
      set: {
        stripeAccountId: account.id,
        oauthScope: input.scope,
        chargesEnabled: account.chargesEnabled,
        payoutsEnabled: account.payoutsEnabled,
        status: "connected",
        lastAccountSyncAt: new Date(),
        updatedAt: new Date(),
      },
    });
  await tx
    .update(paymentConnections)
    .set({
      status: "active",
      externalAccountId: account.id,
      externalAccountDisplay: account.businessName,
      connectedByMembershipId: null,
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
