import { and, asc, eq, sql } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  depositRequirements,
  paymentConnections,
  paymentAllocations,
  paymentAttempts,
  paymentAdjustments,
  paymentExceptions,
  paymentOutboxEvents,
  paymentRecords,
  paymentRequests,
  paymentProviderEvents,
  mercadoPagoProfiles,
  stripeProfiles,
  paypalProfiles,
  manualPaymentSubmissions,
  receivableInstallments,
  receivablePlans,
  quoteVersions,
  quotes,
  agreementVersions,
  agreements,
  tenantMemberships,
} from "@/infrastructure/database/schema";
import {
  createPublicToken,
  hashPublicToken,
} from "@/modules/quotes/domain/public-token";
import { calculateDepositStatus, deriveInstallmentStatus } from "../domain/receivables";
import { assertMoney } from "../domain/money";
import { createHash, timingSafeEqual } from "node:crypto";
import { FakeMercadoPagoAdapter } from "./providers/mercado-pago";
import { FakeStripeAdapter } from "./providers/stripe";
import { FakePayPalAdapter } from "./providers/paypal";

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function refreshPlanStatus(
  tx: TenantTransaction,
  tenantId: string,
  planId: string,
) {
  const installments = await tx
    .select({
      amount: receivableInstallments.amountMinor,
      paid: receivableInstallments.paidAmountMinor,
    })
    .from(receivableInstallments)
    .where(
      and(
        eq(receivableInstallments.tenantId, tenantId),
        eq(receivableInstallments.planId, planId),
      ),
    );
  const expected = installments.reduce((total, row) => total + row.amount, BigInt(0));
  const paid = installments.reduce((total, row) => total + row.paid, BigInt(0));
  const status =
    paid >= expected ? "completed" : paid > BigInt(0) ? "partially_paid" : "open";
  await tx
    .update(receivablePlans)
    .set({
      status,
      updatedAt: new Date(),
      version: sql`${receivablePlans.version} + 1`,
    })
    .where(and(eq(receivablePlans.tenantId, tenantId), eq(receivablePlans.id, planId)));
}

async function outbox(
  tx: TenantTransaction,
  tenantId: string,
  name: string,
  aggregateId: string,
  payload: Record<string, unknown>,
) {
  await tx.insert(paymentOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId,
    name,
    aggregateId,
    payload,
  });
}

export async function createReceivablePlanFromAcceptedQuote(
  tx: TenantTransaction,
  input: { tenantId: string; quoteId: string; membershipId: string },
) {
  const [source] = await tx
    .select({ quote: quotes, version: quoteVersions })
    .from(quotes)
    .innerJoin(
      quoteVersions,
      and(
        eq(quoteVersions.tenantId, quotes.tenantId),
        eq(quoteVersions.quoteId, quotes.id),
      ),
    )
    .where(
      and(
        eq(quotes.tenantId, input.tenantId),
        eq(quotes.id, input.quoteId),
        eq(quotes.status, "accepted"),
      ),
    )
    .orderBy(sql`${quoteVersions.versionNumber} desc`)
    .limit(1);
  if (!source) throw new Error("PAYMENT_SOURCE_NOT_ACCEPTED");
  const existing = await tx
    .select({ id: receivablePlans.id })
    .from(receivablePlans)
    .where(
      and(
        eq(receivablePlans.tenantId, input.tenantId),
        eq(receivablePlans.sourceVersionId, source.version.id),
      ),
    )
    .limit(1);
  if (existing[0]) return { id: existing[0].id, repeated: true };
  const planId = crypto.randomUUID();
  const installmentId = crypto.randomUUID();
  const snapshot = {
    sourceKind: "accepted_quote_version",
    sourceId: source.quote.id,
    sourceVersionId: source.version.id,
    sourceHash: source.version.snapshotHash,
    title: source.quote.title,
    currency: source.quote.currency,
    totalMinor: source.quote.totalMinor.toString(),
  };
  await tx.insert(receivablePlans).values({
    id: planId,
    tenantId: input.tenantId,
    customerAccountId: source.quote.accountId,
    billingContactId: source.quote.contactId,
    sourceKind: "accepted_quote_version",
    sourceId: source.quote.id,
    sourceVersionId: source.version.id,
    sourceHash: source.version.snapshotHash,
    sourceNumber: source.quote.number,
    commercialModel: "fixed",
    currency: source.quote.currency,
    expectedTotalMinor: source.quote.totalMinor,
    scheduledTotalMinor: source.quote.totalMinor,
    snapshot,
    createdByMembershipId: input.membershipId,
  });
  await tx.insert(receivableInstallments).values({
    id: installmentId,
    tenantId: input.tenantId,
    planId,
    sequence: 1,
    label: "Total de la cotizacion",
    dueDate: today(),
    amountMinor: source.quote.totalMinor,
    currency: source.quote.currency,
    kind: "final",
    status: "scheduled",
  });
  await tx.insert(depositRequirements).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    planId,
    policy: "none",
    currency: source.quote.currency,
    status: "not_required",
  });
  return { id: planId, installmentId, repeated: false };
}

export async function createReceivablePlanFromExecutedAgreement(
  tx: TenantTransaction,
  input: { tenantId: string; agreementId: string; membershipId: string },
) {
  const [source] = await tx
    .select({ agreement: agreements, version: agreementVersions, quote: quotes })
    .from(agreements)
    .innerJoin(
      agreementVersions,
      and(
        eq(agreementVersions.tenantId, agreements.tenantId),
        eq(agreementVersions.id, agreements.executedVersionId!),
      ),
    )
    .innerJoin(
      quotes,
      and(eq(quotes.tenantId, agreements.tenantId), eq(quotes.id, agreements.quoteId)),
    )
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
        eq(agreements.status, "executed"),
      ),
    )
    .limit(1);
  if (!source || !source.agreement.executedVersionId)
    throw new Error("PAYMENT_SOURCE_NOT_EXECUTED");
  const existing = await tx
    .select({ id: receivablePlans.id })
    .from(receivablePlans)
    .where(
      and(
        eq(receivablePlans.tenantId, input.tenantId),
        eq(receivablePlans.sourceKind, "executed_agreement_version"),
        eq(receivablePlans.sourceVersionId, source.version.id),
      ),
    )
    .limit(1);
  if (existing[0]) return { id: existing[0].id, repeated: true };
  const planId = crypto.randomUUID();
  const installmentId = crypto.randomUUID();
  const snapshot = {
    sourceKind: "executed_agreement_version",
    sourceId: source.agreement.id,
    sourceVersionId: source.version.id,
    sourceHash: source.version.contentSha256,
    title: source.agreement.title,
    currency: source.quote.currency,
    totalMinor: source.quote.totalMinor.toString(),
  };
  await tx.insert(receivablePlans).values({
    id: planId,
    tenantId: input.tenantId,
    customerAccountId: source.agreement.accountId,
    billingContactId: source.agreement.contactId,
    sourceKind: "executed_agreement_version",
    sourceId: source.agreement.id,
    sourceVersionId: source.version.id,
    sourceHash: source.version.contentSha256,
    sourceNumber: source.version.documentNumber,
    commercialModel: "fixed",
    currency: source.quote.currency,
    expectedTotalMinor: source.quote.totalMinor,
    scheduledTotalMinor: source.quote.totalMinor,
    snapshot,
    createdByMembershipId: input.membershipId,
  });
  await tx.insert(receivableInstallments).values({
    id: installmentId,
    tenantId: input.tenantId,
    planId,
    sequence: 1,
    label: "Total del acuerdo ejecutado",
    dueDate: today(),
    amountMinor: source.quote.totalMinor,
    currency: source.quote.currency,
    kind: "final",
    status: "scheduled",
  });
  await tx.insert(depositRequirements).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    planId,
    policy: "none",
    currency: source.quote.currency,
    status: "not_required",
  });
  return { id: planId, installmentId, repeated: false };
}

export async function openReceivablePlan(
  tx: TenantTransaction,
  input: { tenantId: string; planId: string },
) {
  const [plan] = await tx
    .select()
    .from(receivablePlans)
    .where(
      and(
        eq(receivablePlans.tenantId, input.tenantId),
        eq(receivablePlans.id, input.planId),
      ),
    )
    .for("update")
    .limit(1);
  if (!plan || plan.status !== "draft") throw new Error("PAYMENT_PLAN_NOT_DRAFT");
  await tx
    .update(receivablePlans)
    .set({
      status: "open",
      openedAt: new Date(),
      updatedAt: new Date(),
      version: sql`${receivablePlans.version} + 1`,
    })
    .where(
      and(
        eq(receivablePlans.tenantId, input.tenantId),
        eq(receivablePlans.id, input.planId),
      ),
    );
  await tx
    .update(receivableInstallments)
    .set({ status: "open" })
    .where(
      and(
        eq(receivableInstallments.tenantId, input.tenantId),
        eq(receivableInstallments.planId, input.planId),
      ),
    );
  await outbox(tx, input.tenantId, "ReceivablePlanOpened.v1", input.planId, {
    planId: input.planId,
  });
  return { status: "open" as const };
}

export async function listReceivablePlans(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(receivablePlans)
    .where(eq(receivablePlans.tenantId, tenantId))
    .orderBy(asc(receivablePlans.createdAt));
}

export async function getReceivablePlan(
  tx: TenantTransaction,
  tenantId: string,
  planId: string,
) {
  const [plan] = await tx
    .select()
    .from(receivablePlans)
    .where(and(eq(receivablePlans.tenantId, tenantId), eq(receivablePlans.id, planId)))
    .limit(1);
  if (!plan) throw new Error("PAYMENT_PLAN_NOT_FOUND");
  const installments = await tx
    .select()
    .from(receivableInstallments)
    .where(
      and(
        eq(receivableInstallments.tenantId, tenantId),
        eq(receivableInstallments.planId, planId),
      ),
    )
    .orderBy(asc(receivableInstallments.sequence));
  return { plan, installments };
}

export async function createFakePaymentRequest(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    planId: string;
    installmentId: string;
    membershipId: string;
    idempotencyKey: string;
    expiresAt: Date;
    provider?: "fake" | "mercadopago" | "stripe" | "paypal";
  },
) {
  const [existing] = await tx
    .select()
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.tenantId, input.tenantId),
        eq(paymentRequests.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) return { request: existing, repeated: true };
  const [installment] = await tx
    .select()
    .from(receivableInstallments)
    .where(
      and(
        eq(receivableInstallments.tenantId, input.tenantId),
        eq(receivableInstallments.id, input.installmentId),
        eq(receivableInstallments.planId, input.planId),
      ),
    )
    .for("update")
    .limit(1);
  const [connection] = await tx
    .select()
    .from(paymentConnections)
    .where(
      and(
        eq(paymentConnections.tenantId, input.tenantId),
        eq(paymentConnections.provider, input.provider ?? "fake"),
        eq(paymentConnections.status, "active"),
      ),
    )
    .limit(1);
  if (!installment || !connection) throw new Error("PAYMENT_REQUEST_UNAVAILABLE");
  if ((input.provider ?? "fake") === "mercadopago") {
    const [profile] = await tx
      .select()
      .from(mercadoPagoProfiles)
      .where(
        and(
          eq(mercadoPagoProfiles.tenantId, input.tenantId),
          eq(mercadoPagoProfiles.connectionId, connection.id),
          eq(mercadoPagoProfiles.status, "connected"),
        ),
      )
      .limit(1);
    if (!profile?.sellerUserId)
      throw new Error("MERCADO_PAGO_REAUTHORIZATION_REQUIRED");
  }
  if ((input.provider ?? "fake") === "stripe") {
    const [profile] = await tx
      .select()
      .from(stripeProfiles)
      .where(
        and(
          eq(stripeProfiles.tenantId, input.tenantId),
          eq(stripeProfiles.connectionId, connection.id),
          eq(stripeProfiles.status, "connected"),
          eq(stripeProfiles.chargesEnabled, true),
          eq(stripeProfiles.payoutsEnabled, true),
        ),
      )
      .limit(1);
    if (!profile?.stripeAccountId) throw new Error("STRIPE_ACCOUNT_NOT_READY");
  }
  if ((input.provider ?? "fake") === "paypal") {
    const [profile] = await tx
      .select()
      .from(paypalProfiles)
      .where(
        and(
          eq(paypalProfiles.tenantId, input.tenantId),
          eq(paypalProfiles.connectionId, connection.id),
          eq(paypalProfiles.status, "connected"),
          eq(paypalProfiles.paymentsReceivable, true),
        ),
      )
      .limit(1);
    if (!profile?.merchantId) throw new Error("PAYPAL_MERCHANT_NOT_READY");
  }
  const balance = installment.amountMinor - installment.paidAmountMinor;
  assertMoney(installment.currency, balance);
  const token = createPublicToken();
  const [request] = await tx
    .insert(paymentRequests)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      planId: input.planId,
      installmentId: input.installmentId,
      connectionId: connection.id,
      publicTokenHash: token.hash,
      amountMinor: balance,
      currency: installment.currency,
      descriptionSnapshot: installment.label,
      externalReference: `pay_${crypto.randomUUID()}`,
      status: "open",
      expiresAt: input.expiresAt,
      createdByMembershipId: input.membershipId,
      idempotencyKey: input.idempotencyKey,
      checkoutExternalId: `fake_checkout_pending_${crypto.randomUUID()}`,
      hostedUrl: `/p/${token.token}`,
    })
    .returning();
  await tx.insert(paymentAttempts).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    requestId: request.id,
    connectionId: connection.id,
    externalCheckoutId: request.checkoutExternalId,
    status: "created",
    amountMinor: request.amountMinor,
    currency: request.currency,
    idempotencyKey: `attempt:${request.id}`,
  });
  if ((input.provider ?? "fake") === "mercadopago") {
    const [profile] = await tx
      .select()
      .from(mercadoPagoProfiles)
      .where(
        and(
          eq(mercadoPagoProfiles.tenantId, input.tenantId),
          eq(mercadoPagoProfiles.connectionId, connection.id),
        ),
      )
      .limit(1);
    if (!profile?.sellerUserId)
      throw new Error("MERCADO_PAGO_REAUTHORIZATION_REQUIRED");
    const checkout = await new FakeMercadoPagoAdapter(
      profile.sellerUserId,
    ).createCheckout({
      tenantId: input.tenantId,
      connectionId: connection.id,
      paymentRequestId: request.id,
      idempotencyKey: input.idempotencyKey,
      amountMinor: request.amountMinor,
      currency: request.currency,
      description: request.descriptionSnapshot,
      externalReference: request.externalReference,
      successUrl: `${process.env.PAYMENTS_RETURN_ORIGIN ?? "http://localhost:3000"}/payment-return/${request.id}`,
      cancelUrl: `${process.env.PAYMENTS_RETURN_ORIGIN ?? "http://localhost:3000"}/payment-return/${request.id}`,
      expiresAt: request.expiresAt,
    });
    await tx
      .update(paymentRequests)
      .set({
        checkoutExternalId: checkout.externalCheckoutId,
        hostedUrl: checkout.hostedUrl,
      })
      .where(
        and(
          eq(paymentRequests.tenantId, input.tenantId),
          eq(paymentRequests.id, request.id),
        ),
      );
    request.checkoutExternalId = checkout.externalCheckoutId;
    request.hostedUrl = checkout.hostedUrl;
  }
  if ((input.provider ?? "fake") === "stripe") {
    const [profile] = await tx
      .select()
      .from(stripeProfiles)
      .where(
        and(
          eq(stripeProfiles.tenantId, input.tenantId),
          eq(stripeProfiles.connectionId, connection.id),
        ),
      )
      .limit(1);
    if (!profile?.stripeAccountId) throw new Error("STRIPE_ACCOUNT_NOT_READY");
    const checkout = await new FakeStripeAdapter(
      profile.stripeAccountId,
    ).createCheckout({
      tenantId: input.tenantId,
      connectionId: connection.id,
      paymentRequestId: request.id,
      idempotencyKey: input.idempotencyKey,
      amountMinor: request.amountMinor,
      currency: request.currency,
      description: request.descriptionSnapshot,
      externalReference: request.externalReference,
      successUrl: `${process.env.PAYMENTS_RETURN_ORIGIN ?? "http://localhost:3000"}/payment-return/${request.id}`,
      cancelUrl: `${process.env.PAYMENTS_RETURN_ORIGIN ?? "http://localhost:3000"}/payment-return/${request.id}`,
      expiresAt: request.expiresAt,
    });
    await tx
      .update(paymentRequests)
      .set({
        checkoutExternalId: checkout.externalCheckoutId,
        hostedUrl: checkout.hostedUrl,
      })
      .where(
        and(
          eq(paymentRequests.tenantId, input.tenantId),
          eq(paymentRequests.id, request.id),
        ),
      );
    request.checkoutExternalId = checkout.externalCheckoutId;
    request.hostedUrl = checkout.hostedUrl;
  }
  if ((input.provider ?? "fake") === "paypal") {
    const [profile] = await tx
      .select()
      .from(paypalProfiles)
      .where(
        and(
          eq(paypalProfiles.tenantId, input.tenantId),
          eq(paypalProfiles.connectionId, connection.id),
        ),
      )
      .limit(1);
    if (!profile?.merchantId) throw new Error("PAYPAL_MERCHANT_NOT_READY");
    const checkout = await new FakePayPalAdapter(profile.merchantId).createCheckout({
      tenantId: input.tenantId,
      connectionId: connection.id,
      paymentRequestId: request.id,
      idempotencyKey: input.idempotencyKey,
      amountMinor: request.amountMinor,
      currency: request.currency,
      description: request.descriptionSnapshot,
      externalReference: request.externalReference,
      successUrl: `${process.env.PAYMENTS_RETURN_ORIGIN ?? "http://localhost:3000"}/payment-return/${request.id}`,
      cancelUrl: `${process.env.PAYMENTS_RETURN_ORIGIN ?? "http://localhost:3000"}/payment-return/${request.id}`,
      expiresAt: request.expiresAt,
    });
    await tx
      .update(paymentRequests)
      .set({
        checkoutExternalId: checkout.externalCheckoutId,
        hostedUrl: checkout.hostedUrl,
      })
      .where(
        and(
          eq(paymentRequests.tenantId, input.tenantId),
          eq(paymentRequests.id, request.id),
        ),
      );
    request.checkoutExternalId = checkout.externalCheckoutId;
    request.hostedUrl = checkout.hostedUrl;
  }
  await outbox(tx, input.tenantId, "PaymentRequestOpened.v1", request.id, {
    paymentRequestId: request.id,
    installmentId: input.installmentId,
  });
  return { request, repeated: false };
}

export async function getPublicPaymentRequest(tx: TenantTransaction, token: string) {
  const hash = hashPublicToken(token);
  const [request] = await tx
    .select()
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.publicTokenHash, hash),
        sql`${paymentRequests.status} in ('open', 'paid')`,
      ),
    )
    .limit(1);
  if (!request || (request.status === "open" && request.expiresAt <= new Date()))
    throw new Error("PAYMENT_REQUEST_EXPIRED");
  return {
    id: request.id,
    amountMinor: request.amountMinor.toString(),
    currency: request.currency,
    description: request.descriptionSnapshot,
    status: request.status,
  };
}

export async function getPublicPaymentCheckoutUrl(
  tx: TenantTransaction,
  token: string,
) {
  const hash = hashPublicToken(token);
  const [request] = await tx
    .select({
      hostedUrl: paymentRequests.hostedUrl,
      expiresAt: paymentRequests.expiresAt,
    })
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.publicTokenHash, hash),
        eq(paymentRequests.status, "open"),
      ),
    )
    .limit(1);
  if (!request?.hostedUrl || request.expiresAt <= new Date())
    throw new Error("PAYMENT_REQUEST_EXPIRED");
  const url = new URL(request.hostedUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("PAYMENT_HOSTED_URL_INVALID");
  return url.toString();
}

export async function confirmFakePayment(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    requestId: string;
    actorUserId: string;
    provider?: "fake" | "mercadopago" | "stripe" | "paypal";
  },
) {
  const [request] = await tx
    .select()
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.tenantId, input.tenantId),
        eq(paymentRequests.id, input.requestId),
      ),
    )
    .for("update")
    .limit(1);
  if (!request || request.status !== "open")
    throw new Error("PAYMENT_REQUEST_NOT_OPEN");
  const [payment] = await tx
    .insert(paymentRecords)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      planId: request.planId,
      requestId: request.id,
      provider: input.provider ?? "fake",
      method: input.provider === "fake" ? "fake_checkout" : "provider",
      externalPaymentId: `fake_payment_${request.id}`,
      amountMinor: request.amountMinor,
      currency: request.currency,
      status: "confirmed",
      createdByUserId: input.actorUserId,
      confirmedAt: new Date(),
    })
    .returning();
  const [installment] = await tx
    .select()
    .from(receivableInstallments)
    .where(
      and(
        eq(receivableInstallments.tenantId, input.tenantId),
        eq(receivableInstallments.id, request.installmentId),
      ),
    )
    .for("update")
    .limit(1);
  if (!installment || installment.currency !== payment.currency)
    throw new Error("PAYMENT_CURRENCY_MISMATCH");
  const paid = installment.paidAmountMinor + payment.amountMinor;
  const status = deriveInstallmentStatus({
    amountMinor: installment.amountMinor,
    paidAmountMinor: paid,
    dueDate: installment.dueDate,
    today: today(),
    planOpen: true,
  });
  await tx.insert(paymentAllocations).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    paymentId: payment.id,
    installmentId: installment.id,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    createdByUserId: input.actorUserId,
  });
  await tx
    .update(receivableInstallments)
    .set({
      paidAmountMinor: paid,
      status,
      paidAt: status === "paid" ? new Date() : null,
      version: sql`${receivableInstallments.version} + 1`,
    })
    .where(
      and(
        eq(receivableInstallments.tenantId, input.tenantId),
        eq(receivableInstallments.id, installment.id),
      ),
    );
  await tx
    .update(paymentAttempts)
    .set({
      status: "succeeded",
      externalPaymentId: payment.externalPaymentId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentAttempts.tenantId, input.tenantId),
        eq(paymentAttempts.requestId, request.id),
      ),
    );
  await refreshPlanStatus(tx, input.tenantId, request.planId);
  const [deposit] = await tx
    .select()
    .from(depositRequirements)
    .where(
      and(
        eq(depositRequirements.tenantId, input.tenantId),
        eq(depositRequirements.planId, request.planId),
      ),
    )
    .for("update")
    .limit(1);
  const depositApplies =
    deposit &&
    deposit.status !== "not_required" &&
    deposit.qualifyingInstallmentIds.includes(installment.id);
  if (depositApplies) {
    const satisfied = deposit.satisfiedAmountMinor + payment.amountMinor;
    const depositStatus = calculateDepositStatus(
      deposit.requiredAmountMinor,
      satisfied,
    );
    const becameSatisfied =
      deposit.status !== "satisfied" && depositStatus === "satisfied";
    await tx
      .update(depositRequirements)
      .set({
        satisfiedAmountMinor: satisfied,
        status: depositStatus,
        satisfiedAt: depositStatus === "satisfied" ? new Date() : null,
        version: sql`${depositRequirements.version} + 1`,
      })
      .where(
        and(
          eq(depositRequirements.tenantId, input.tenantId),
          eq(depositRequirements.id, deposit.id),
        ),
      );
    if (becameSatisfied) {
      await outbox(tx, input.tenantId, "DepositRequirementSatisfied.v1", deposit.id, {
        depositRequirementId: deposit.id,
        planId: request.planId,
        paymentId: payment.id,
        satisfiedAmountMinor: satisfied.toString(),
        currency: deposit.currency,
      });
    }
  }
  await tx
    .update(paymentRequests)
    .set({
      status: "paid",
      fulfilledAt: new Date(),
      version: sql`${paymentRequests.version} + 1`,
    })
    .where(
      and(
        eq(paymentRequests.tenantId, input.tenantId),
        eq(paymentRequests.id, request.id),
      ),
    );
  await outbox(tx, input.tenantId, "PaymentConfirmed.v1", payment.id, {
    paymentId: payment.id,
    planId: request.planId,
    installmentId: installment.id,
    amountMinor: payment.amountMinor.toString(),
    currency: payment.currency,
  });
  return payment;
}

export async function submitManualPayment(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    planId: string;
    installmentId?: string;
    amountMinor: bigint;
    currency: string;
    paidAt: Date;
    method: "manual_transfer" | "cash" | "check";
    membershipId: string;
    idempotencyKey: string;
    referenceMasked?: string;
    institution?: string;
    note?: string;
    evidenceKey?: string;
  },
) {
  assertMoney(input.currency, input.amountMinor);
  const [existing] = await tx
    .select()
    .from(manualPaymentSubmissions)
    .where(
      and(
        eq(manualPaymentSubmissions.tenantId, input.tenantId),
        eq(manualPaymentSubmissions.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) return { submission: existing, repeated: true };
  const [plan] = await tx
    .select()
    .from(receivablePlans)
    .where(
      and(
        eq(receivablePlans.tenantId, input.tenantId),
        eq(receivablePlans.id, input.planId),
      ),
    )
    .limit(1);
  if (!plan || plan.currency !== input.currency)
    throw new Error("PAYMENT_CURRENCY_MISMATCH");
  if (input.installmentId) {
    const [installment] = await tx
      .select({ currency: receivableInstallments.currency })
      .from(receivableInstallments)
      .where(
        and(
          eq(receivableInstallments.tenantId, input.tenantId),
          eq(receivableInstallments.id, input.installmentId),
          eq(receivableInstallments.planId, input.planId),
        ),
      )
      .limit(1);
    if (!installment || installment.currency !== input.currency)
      throw new Error("PAYMENT_INSTALLMENT_NOT_FOUND");
  }
  const [submission] = await tx
    .insert(manualPaymentSubmissions)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      planId: input.planId,
      installmentId: input.installmentId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      paidAt: input.paidAt,
      method: input.method,
      referenceMasked: input.referenceMasked,
      institution: input.institution,
      note: input.note,
      evidenceKey: input.evidenceKey,
      submittedByMembershipId: input.membershipId,
      idempotencyKey: input.idempotencyKey,
    })
    .returning();
  await outbox(tx, input.tenantId, "ManualPaymentSubmitted.v1", submission.id, {
    submissionId: submission.id,
    planId: input.planId,
    amountMinor: input.amountMinor.toString(),
    currency: input.currency,
  });
  return { submission, repeated: false };
}

export async function reviewManualPayment(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    submissionId: string;
    reviewerMembershipId: string;
    reviewerUserId: string;
    decision: "approve" | "reject";
    reason?: string;
  },
) {
  const [submission] = await tx
    .select()
    .from(manualPaymentSubmissions)
    .where(
      and(
        eq(manualPaymentSubmissions.tenantId, input.tenantId),
        eq(manualPaymentSubmissions.id, input.submissionId),
      ),
    )
    .for("update")
    .limit(1);
  if (!submission) throw new Error("PAYMENT_MANUAL_NOT_FOUND");
  if (submission.status !== "pending_review") {
    if (submission.status === "approved" && input.decision === "approve")
      return { repeated: true, status: submission.status };
    throw new Error("PAYMENT_MANUAL_ALREADY_REVIEWED");
  }
  if (submission.submittedByMembershipId === input.reviewerMembershipId)
    throw new Error("PAYMENT_MANUAL_SELF_REVIEW");
  if (input.decision === "reject" && !input.reason?.trim())
    throw new Error("PAYMENT_MANUAL_REASON_REQUIRED");
  if (input.decision === "reject") {
    await tx
      .update(manualPaymentSubmissions)
      .set({
        status: "rejected",
        reviewedByMembershipId: input.reviewerMembershipId,
        decisionReason: input.reason,
        reviewedAt: new Date(),
        version: sql`${manualPaymentSubmissions.version} + 1`,
      })
      .where(
        and(
          eq(manualPaymentSubmissions.tenantId, input.tenantId),
          eq(manualPaymentSubmissions.id, submission.id),
        ),
      );
    await outbox(tx, input.tenantId, "ManualPaymentRejected.v1", submission.id, {
      submissionId: submission.id,
      reason: input.reason,
    });
    return { repeated: false, status: "rejected" as const };
  }
  const [payment] = await tx
    .insert(paymentRecords)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      planId: submission.planId,
      provider: "manual",
      method: submission.method,
      externalPaymentId: `manual_payment_${submission.id}`,
      amountMinor: submission.amountMinor,
      currency: submission.currency,
      status: "confirmed",
      referenceMasked: submission.referenceMasked,
      note: submission.note,
      createdByUserId: input.reviewerUserId,
      reviewedByUserId: input.reviewerUserId,
      confirmedAt: submission.paidAt,
    })
    .returning();
  if (submission.installmentId) {
    const [installment] = await tx
      .select()
      .from(receivableInstallments)
      .where(
        and(
          eq(receivableInstallments.tenantId, input.tenantId),
          eq(receivableInstallments.id, submission.installmentId),
        ),
      )
      .for("update")
      .limit(1);
    if (!installment || installment.currency !== payment.currency)
      throw new Error("PAYMENT_CURRENCY_MISMATCH");
    const outstanding = installment.amountMinor - installment.paidAmountMinor;
    const applied =
      payment.amountMinor <= outstanding ? payment.amountMinor : outstanding;
    if (applied > BigInt(0)) {
      await tx.insert(paymentAllocations).values({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        paymentId: payment.id,
        installmentId: installment.id,
        amountMinor: applied,
        currency: payment.currency,
        createdByUserId: input.reviewerUserId,
      });
      const paid = installment.paidAmountMinor + applied;
      await tx
        .update(receivableInstallments)
        .set({
          paidAmountMinor: paid,
          status: deriveInstallmentStatus({
            amountMinor: installment.amountMinor,
            paidAmountMinor: paid,
            dueDate: installment.dueDate,
            today: today(),
            planOpen: true,
          }),
          paidAt: paid >= installment.amountMinor ? new Date() : null,
          version: sql`${receivableInstallments.version} + 1`,
        })
        .where(
          and(
            eq(receivableInstallments.tenantId, input.tenantId),
            eq(receivableInstallments.id, installment.id),
          ),
        );
    }
    if (payment.amountMinor > outstanding) {
      await openPaymentException(tx, {
        tenantId: input.tenantId,
        type: "overpayment",
        paymentId: payment.id,
        requestId: null,
        expectedSnapshot: { outstanding: outstanding.toString() },
        observedSnapshot: { amountMinor: payment.amountMinor.toString() },
      });
    }
    const [deposit] = await tx
      .select()
      .from(depositRequirements)
      .where(
        and(
          eq(depositRequirements.tenantId, input.tenantId),
          eq(depositRequirements.planId, submission.planId),
        ),
      )
      .for("update")
      .limit(1);
    if (
      deposit &&
      deposit.status !== "not_required" &&
      deposit.qualifyingInstallmentIds.includes(installment.id)
    ) {
      const satisfied = deposit.satisfiedAmountMinor + payment.amountMinor;
      const depositStatus = calculateDepositStatus(
        deposit.requiredAmountMinor,
        satisfied,
      );
      const becameSatisfied =
        deposit.status !== "satisfied" && depositStatus === "satisfied";
      await tx
        .update(depositRequirements)
        .set({
          satisfiedAmountMinor: satisfied,
          status: depositStatus,
          satisfiedAt: depositStatus === "satisfied" ? new Date() : null,
          version: sql`${depositRequirements.version} + 1`,
        })
        .where(
          and(
            eq(depositRequirements.tenantId, input.tenantId),
            eq(depositRequirements.id, deposit.id),
          ),
        );
      if (becameSatisfied)
        await outbox(tx, input.tenantId, "DepositRequirementSatisfied.v1", deposit.id, {
          depositRequirementId: deposit.id,
          planId: submission.planId,
          paymentId: payment.id,
          satisfiedAmountMinor: satisfied.toString(),
          currency: deposit.currency,
        });
    }
  }
  await tx
    .update(manualPaymentSubmissions)
    .set({
      status: "approved",
      reviewedByMembershipId: input.reviewerMembershipId,
      reviewedAt: new Date(),
      version: sql`${manualPaymentSubmissions.version} + 1`,
    })
    .where(
      and(
        eq(manualPaymentSubmissions.tenantId, input.tenantId),
        eq(manualPaymentSubmissions.id, submission.id),
      ),
    );
  await refreshPlanStatus(tx, input.tenantId, submission.planId);
  await outbox(tx, input.tenantId, "PaymentConfirmed.v1", payment.id, {
    paymentId: payment.id,
    planId: submission.planId,
    amountMinor: payment.amountMinor.toString(),
    currency: payment.currency,
    origin: "manual",
  });
  return { repeated: false, status: "approved" as const, payment };
}

export async function openPaymentException(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    type:
      | "amount_mismatch"
      | "currency_mismatch"
      | "overpayment"
      | "manual_duplicate_suspected"
      | "refund_or_chargeback"
      | "stale_processing";
    paymentId?: string | null;
    requestId?: string | null;
    expectedSnapshot: Record<string, unknown>;
    observedSnapshot: Record<string, unknown>;
  },
) {
  const [exception] = await tx
    .insert(paymentExceptions)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      type: input.type,
      paymentId: input.paymentId ?? null,
      requestId: input.requestId ?? null,
      expectedSnapshot: input.expectedSnapshot,
      observedSnapshot: input.observedSnapshot,
    })
    .returning();
  await outbox(tx, input.tenantId, "PaymentExceptionOpened.v1", exception.id, {
    exceptionId: exception.id,
    type: input.type,
    paymentId: input.paymentId,
    requestId: input.requestId,
  });
  return exception;
}

export async function recordPaymentAdjustment(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    paymentId: string;
    kind: "partial_refund" | "full_refund" | "chargeback" | "reversal" | "correction";
    amountMinor: bigint;
    currency: string;
    reason: string;
    createdByUserId: string;
    externalAdjustmentId?: string;
  },
) {
  assertMoney(input.currency, input.amountMinor);
  const [payment] = await tx
    .select()
    .from(paymentRecords)
    .where(
      and(
        eq(paymentRecords.tenantId, input.tenantId),
        eq(paymentRecords.id, input.paymentId),
      ),
    )
    .limit(1);
  if (!payment || payment.currency !== input.currency)
    throw new Error("PAYMENT_NOT_FOUND");
  const [adjustment] = await tx
    .insert(paymentAdjustments)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      paymentId: input.paymentId,
      kind: input.kind,
      amountMinor: input.amountMinor,
      currency: input.currency,
      externalAdjustmentId: input.externalAdjustmentId,
      reason: input.reason,
      createdByUserId: input.createdByUserId,
    })
    .onConflictDoNothing()
    .returning();
  if (!adjustment) return { repeated: true };
  await tx
    .update(paymentRecords)
    .set({ status: "reversed" })
    .where(
      and(
        eq(paymentRecords.tenantId, input.tenantId),
        eq(paymentRecords.id, input.paymentId),
      ),
    );
  await openPaymentException(tx, {
    tenantId: input.tenantId,
    type: "refund_or_chargeback",
    paymentId: input.paymentId,
    expectedSnapshot: { paymentAmountMinor: payment.amountMinor.toString() },
    observedSnapshot: {
      adjustmentAmountMinor: input.amountMinor.toString(),
      kind: input.kind,
    },
  });
  await outbox(tx, input.tenantId, "PaymentAdjustmentRecorded.v1", adjustment.id, {
    adjustmentId: adjustment.id,
    paymentId: input.paymentId,
    amountMinor: input.amountMinor.toString(),
    currency: input.currency,
    kind: input.kind,
  });
  return { adjustment, repeated: false };
}

export async function processFakePaymentWebhook(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    connectionId: string;
    eventId: string;
    requestId: string;
    amountMinor: bigint;
    currency: string;
    provider?: "fake" | "mercadopago" | "stripe" | "paypal";
  },
) {
  const digest = createHash("sha256")
    .update(
      `${input.eventId}:${input.requestId}:${input.amountMinor}:${input.currency}`,
    )
    .digest("hex");
  const [existing] = await tx
    .select({ id: paymentProviderEvents.id })
    .from(paymentProviderEvents)
    .where(
      and(
        eq(paymentProviderEvents.connectionId, input.connectionId),
        eq(paymentProviderEvents.eventKey, input.eventId),
      ),
    )
    .limit(1);
  if (existing) return { repeated: true };
  const [request] = await tx
    .select({ request: paymentRequests, membership: tenantMemberships })
    .from(paymentRequests)
    .innerJoin(
      tenantMemberships,
      and(
        eq(tenantMemberships.tenantId, paymentRequests.tenantId),
        eq(tenantMemberships.id, paymentRequests.createdByMembershipId),
      ),
    )
    .where(
      and(
        eq(paymentRequests.tenantId, input.tenantId),
        eq(paymentRequests.id, input.requestId),
        eq(paymentRequests.connectionId, input.connectionId),
      ),
    )
    .limit(1);
  if (!request || request.request.amountMinor !== input.amountMinor)
    throw new Error("PAYMENT_AMOUNT_MISMATCH");
  if (request.request.currency !== input.currency)
    throw new Error("PAYMENT_CURRENCY_MISMATCH");
  await tx.insert(paymentProviderEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    connectionId: input.connectionId,
    eventKey: input.eventId,
    kind: "payment_confirmed",
    digest,
    processedAt: new Date(),
  });
  const payment = await confirmFakePayment(tx, {
    tenantId: input.tenantId,
    requestId: input.requestId,
    actorUserId: request.membership.userId,
    provider: input.provider,
  });
  return { repeated: false, payment };
}

export function verifyFakeWebhookSignature(raw: string, signature: string | null) {
  if (!signature) return false;
  const expected = createHash("sha256").update(`fake:${raw}`).digest("hex");
  const actual = Buffer.from(signature, "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}
