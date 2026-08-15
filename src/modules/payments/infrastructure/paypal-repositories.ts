import { and, eq } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import { paymentConnections, paypalProfiles } from "@/infrastructure/database/schema";
import { fakePayPalServer } from "./providers/paypal";
import { maskPayPalEmail } from "../domain/paypal";

export async function beginPayPalOnboarding(
  tx: TenantTransaction,
  input: { tenantId: string },
) {
  let [connection] = await tx
    .select()
    .from(paymentConnections)
    .where(
      and(
        eq(paymentConnections.tenantId, input.tenantId),
        eq(paymentConnections.provider, "paypal"),
      ),
    )
    .limit(1);
  if (!connection)
    [connection] = await tx
      .insert(paymentConnections)
      .values({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        provider: "paypal",
        environment: "sandbox",
        displayName: "PayPal",
        capabilities: {
          sellerOnboarding: true,
          ordersV2: true,
          serverCapture: true,
          webhooks: true,
        },
        status: "authorization_pending",
      })
      .returning();
  const referral = fakePayPalServer.createPartnerReferral();
  await tx
    .insert(paypalProfiles)
    .values({
      tenantId: input.tenantId,
      connectionId: connection.id,
      environment: "fake",
      status: "onboarding_pending",
      onboardingActionRef: referral.actionRef,
    })
    .onConflictDoUpdate({
      target: [paypalProfiles.tenantId, paypalProfiles.connectionId],
      set: {
        status: "onboarding_pending",
        onboardingActionRef: referral.actionRef,
        updatedAt: new Date(),
      },
    });
  return { connection, ...referral };
}

export async function completeFakePayPalOnboarding(
  tx: TenantTransaction,
  input: { tenantId: string; connectionId: string; merchantId: string },
) {
  const merchant = fakePayPalServer.getMerchant(input.merchantId);
  if (!merchant.paymentsReceivable || merchant.consentStatus !== "active")
    throw new Error("PAYPAL_MERCHANT_NOT_READY");
  await tx
    .insert(paypalProfiles)
    .values({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      environment: "fake",
      merchantId: merchant.merchantId,
      emailMasked: maskPayPalEmail(merchant.email),
      countryCode: merchant.countryCode,
      product: merchant.product,
      paymentsReceivable: merchant.paymentsReceivable,
      consentStatus: merchant.consentStatus,
      capabilities: merchant.capabilities,
      status: "connected",
      lastHealthCheckAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [paypalProfiles.tenantId, paypalProfiles.connectionId],
      set: {
        merchantId: merchant.merchantId,
        emailMasked: maskPayPalEmail(merchant.email),
        paymentsReceivable: true,
        consentStatus: "active",
        capabilities: merchant.capabilities,
        status: "connected",
        lastHealthCheckAt: new Date(),
        updatedAt: new Date(),
      },
    });
  await tx
    .update(paymentConnections)
    .set({
      status: "active",
      externalAccountId: merchant.merchantId,
      externalAccountDisplay: maskPayPalEmail(merchant.email),
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
