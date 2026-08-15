import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  commercialContacts,
  contactMethods,
  quoteClientDecisions,
  quoteDraftItems,
  quoteDrafts,
  quoteDraftSections,
  quoteEmailChallenges,
  quoteOutboxEvents,
  quoteItems,
  quoteNumberSequences,
  quotePublicLinks,
  quotePublicSessions,
  quotes,
  quoteVersions,
} from "@/infrastructure/database/schema";
import { calculateLine, calculateTotals, type QuoteLineInput } from "../domain/pricing";
import {
  createPublicSessionToken,
  createPublicToken,
  hashPublicToken,
} from "../domain/public-token";
import { renderQuotePdf } from "../domain/quote-pdf";
import { LocalObjectStorage } from "@/infrastructure/object-storage/local";
import { sha256Canonical } from "@/modules/agreements/domain/canonical";
import { reconcileProjectCommercialScope } from "@/modules/projects/infrastructure/repositories";
import {
  createPublicOtp,
  encryptOtpDeliveryCode,
  hashPublicOtp,
  shouldExposeOtpCodeForTest,
} from "@/infrastructure/security/public-otp";
import { constantTimeEqual } from "@/infrastructure/security/constant-time";

export type CreateQuoteInput = {
  tenantId: string;
  actorUserId: string;
  ownerMembershipId?: string;
  title: string;
  currency: string;
  accountId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  expiresAt?: Date | null;
  lines: Array<QuoteLineInput & { description: string }>;
};

export async function createQuote(tx: TenantTransaction, input: CreateQuoteInput) {
  if (input.lines.length === 0) throw new Error("QUOTE_LINES_REQUIRED");
  const totals = calculateTotals(input.lines);
  const quoteId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const items = input.lines.map((line, index) => ({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    quoteId,
    position: index + 1,
    description: line.description,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
    discountType: line.discount.type,
    discountValue: line.discount.value,
    taxRateBps: line.taxRateBps,
    ...calculateLine(line),
  }));
  const snapshot = {
    title: input.title,
    currency: input.currency,
    lines: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor.toString(),
      discountType: item.discountType,
      discountValue: item.discountValue.toString(),
      taxRateBps: item.taxRateBps.toString(),
      subtotalMinor: item.subtotalMinor.toString(),
      discountMinor: item.discountMinor.toString(),
      taxMinor: item.taxMinor.toString(),
      totalMinor: item.totalMinor.toString(),
    })),
    totals: Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, value.toString()]),
    ),
  };

  await tx.insert(quotes).values({
    id: quoteId,
    tenantId: input.tenantId,
    title: input.title,
    currency: input.currency,
    accountId: input.accountId ?? null,
    contactId: input.contactId ?? null,
    opportunityId: input.opportunityId ?? null,
    expiresAt: input.expiresAt ?? null,
    subtotalMinor: totals.subtotalMinor,
    discountMinor: totals.discountMinor,
    taxMinor: totals.taxMinor,
    totalMinor: totals.totalMinor,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
    ownerMembershipId: input.ownerMembershipId ?? null,
  });
  await tx.insert(quoteItems).values(items);
  await tx.insert(quoteVersions).values({
    id: versionId,
    tenantId: input.tenantId,
    quoteId,
    versionNumber: 1,
    snapshot,
    snapshotHash: sha256Canonical(snapshot),
    createdByUserId: input.actorUserId,
  });
  await tx.insert(quoteDrafts).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    quoteId,
    title: input.title,
    pricingModel: "fixed",
    currency: input.currency,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  });
  return { id: quoteId, version: 1, totals };
}

export async function issueQuotePdf(
  tx: TenantTransaction,
  input: { tenantId: string; quoteId: string; actorUserId: string },
) {
  const [quote] = await tx
    .select()
    .from(quotes)
    .where(and(eq(quotes.tenantId, input.tenantId), eq(quotes.id, input.quoteId)))
    .limit(1);
  if (!quote || quote.status !== "issued" || !quote.number)
    throw new Error("QUOTE_NOT_ISSUED");
  const [version] = await tx
    .select()
    .from(quoteVersions)
    .where(
      and(
        eq(quoteVersions.tenantId, input.tenantId),
        eq(quoteVersions.quoteId, input.quoteId),
      ),
    )
    .orderBy(sql`${quoteVersions.versionNumber} desc`)
    .limit(1);
  if (!version) throw new Error("QUOTE_VERSION_NOT_FOUND");
  const snapshot = version.snapshot;
  const lines = Array.isArray(snapshot.lines)
    ? (snapshot.lines as Array<Record<string, unknown>>)
    : [];
  const pdf = await renderQuotePdf({
    title: String(snapshot.title ?? quote.title),
    number: quote.number,
    version: version.versionNumber,
    currency: quote.currency,
    customerName: "Cliente",
    lines: lines.map((line) => ({
      description: String(line.description ?? "Servicio"),
      quantity: String(line.quantity ?? "1"),
      totalMinor: String(line.totalMinor ?? "0"),
    })),
    totalMinor: quote.totalMinor.toString(),
    contentHash: version.snapshotHash,
  });
  const storage = new LocalObjectStorage();
  const stored = await storage.put({
    tenantId: input.tenantId,
    key: `quotes/${quote.id}/${version.id}/content.pdf`,
    body: pdf,
    contentType: "application/pdf",
  });
  await tx
    .update(quoteVersions)
    .set({
      pdfKey: stored.key,
      pdfSha256: stored.sha256,
      rendererVersion: "quote-pdf-v1",
    })
    .where(
      and(eq(quoteVersions.tenantId, input.tenantId), eq(quoteVersions.id, version.id)),
    );
  return {
    quoteId: quote.id,
    versionId: version.id,
    key: stored.key,
    sha256: stored.sha256,
  };
}

export async function listQuotes(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(quotes)
    .where(eq(quotes.tenantId, tenantId))
    .orderBy(asc(quotes.updatedAt));
}

export async function issueQuote(
  tx: TenantTransaction,
  input: { tenantId: string; quoteId: string; actorUserId: string },
) {
  const [quote] = await tx
    .select({ id: quotes.id, status: quotes.status, contactId: quotes.contactId })
    .from(quotes)
    .where(and(eq(quotes.tenantId, input.tenantId), eq(quotes.id, input.quoteId)))
    .limit(1);
  if (!quote) throw new Error("QUOTE_NOT_FOUND");
  if (quote.status !== "draft") throw new Error("QUOTE_ALREADY_ISSUED");

  await tx
    .insert(quoteNumberSequences)
    .values({ tenantId: input.tenantId })
    .onConflictDoNothing({ target: quoteNumberSequences.tenantId });
  const sequenceRows = await tx.execute(
    sql`select prefix, next_value from quote_number_sequences where tenant_id = ${input.tenantId} for update`,
  );
  const sequence = sequenceRows[0] as
    { prefix: string; next_value: number } | undefined;
  if (!sequence) throw new Error("QUOTE_NUMBER_SEQUENCE_UNAVAILABLE");
  await tx
    .update(quoteNumberSequences)
    .set({ nextValue: sequence.next_value + 1, updatedAt: new Date() })
    .where(eq(quoteNumberSequences.tenantId, input.tenantId));
  const number = `${sequence.prefix}-${String(sequence.next_value).padStart(6, "0")}`;
  const [issued] = await tx
    .update(quotes)
    .set({
      number,
      status: "issued",
      updatedByUserId: input.actorUserId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(quotes.tenantId, input.tenantId),
        eq(quotes.id, input.quoteId),
        eq(quotes.status, "draft"),
      ),
    )
    .returning({ id: quotes.id, number: quotes.number, status: quotes.status });
  if (!issued) throw new Error("QUOTE_ALREADY_ISSUED");
  return issued;
}

export async function createQuotePublicLink(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    quoteId: string;
    actorUserId: string;
    expiresAt?: Date | null;
  },
) {
  const [quote] = await tx
    .select({ id: quotes.id, status: quotes.status, contactId: quotes.contactId })
    .from(quotes)
    .where(and(eq(quotes.tenantId, input.tenantId), eq(quotes.id, input.quoteId)))
    .limit(1);
  if (!quote) throw new Error("QUOTE_NOT_FOUND");
  if (quote.status !== "issued" && quote.status !== "viewed")
    throw new Error("QUOTE_NOT_ISSUED");
  if (!quote.contactId) throw new Error("QUOTE_RECIPIENT_EMAIL_REQUIRED");
  const [recipient] = await tx
    .select({ id: contactMethods.id })
    .from(contactMethods)
    .innerJoin(
      commercialContacts,
      and(
        eq(commercialContacts.tenantId, contactMethods.tenantId),
        eq(commercialContacts.id, contactMethods.contactId),
      ),
    )
    .where(
      and(
        eq(contactMethods.tenantId, input.tenantId),
        eq(contactMethods.contactId, quote.contactId),
        eq(contactMethods.type, "email"),
        eq(contactMethods.status, "active"),
        eq(contactMethods.isPrimary, true),
        eq(commercialContacts.status, "active"),
        eq(commercialContacts.doNotContact, false),
      ),
    )
    .limit(1);
  if (!recipient) throw new Error("QUOTE_RECIPIENT_EMAIL_REQUIRED");
  const [version] = await tx
    .select({ pdfKey: quoteVersions.pdfKey })
    .from(quoteVersions)
    .where(
      and(
        eq(quoteVersions.tenantId, input.tenantId),
        eq(quoteVersions.quoteId, input.quoteId),
      ),
    )
    .orderBy(sql`${quoteVersions.versionNumber} desc`)
    .limit(1);
  if (!version?.pdfKey) throw new Error("QUOTE_PDF_REQUIRED");
  const token = createPublicToken();
  await tx.insert(quotePublicLinks).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    quoteId: input.quoteId,
    tokenHash: token.hash,
    expiresAt: input.expiresAt ?? null,
    createdByUserId: input.actorUserId,
  });
  return token.token;
}

export async function getPublicQuote(tx: TenantTransaction, token: string) {
  const [link] = await tx
    .select({ quoteId: quotePublicLinks.quoteId, tenantId: quotePublicLinks.tenantId })
    .from(quotePublicLinks)
    .where(
      and(
        eq(quotePublicLinks.tokenHash, hashPublicToken(token)),
        eq(quotePublicLinks.active, true),
      ),
    )
    .limit(1);
  if (!link) throw new Error("PUBLIC_QUOTE_NOT_FOUND");
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${link.tenantId}, true)`,
  );
  const [quote] = await tx
    .select()
    .from(quotes)
    .where(and(eq(quotes.tenantId, link.tenantId), eq(quotes.id, link.quoteId)))
    .limit(1);
  if (!quote || quote.status === "draft" || quote.status === "cancelled") {
    throw new Error("PUBLIC_QUOTE_NOT_AVAILABLE");
  }
  await tx
    .update(quotePublicLinks)
    .set({ lastAccessedAt: new Date() })
    .where(
      and(
        eq(quotePublicLinks.tenantId, link.tenantId),
        eq(quotePublicLinks.quoteId, link.quoteId),
        eq(quotePublicLinks.tokenHash, hashPublicToken(token)),
      ),
    );
  const items = await tx
    .select()
    .from(quoteItems)
    .where(
      and(eq(quoteItems.tenantId, link.tenantId), eq(quoteItems.quoteId, link.quoteId)),
    )
    .orderBy(asc(quoteItems.position));
  return { quote, items };
}

export async function exchangePublicQuoteLink(tx: TenantTransaction, token: string) {
  const session = createPublicSessionToken();
  const csrf = createPublicSessionToken();
  const rows = await tx.execute(
    sql`select public.exchange_quote_link_and_create_session(
      ${hashPublicToken(token)},
      ${session.hash},
      ${csrf.hash},
      ${new Date(Date.now() + 60 * 60 * 1000).toISOString()}
    ) as tenant_id`,
  );
  if (!(rows[0] as { tenant_id?: string } | undefined)?.tenant_id)
    throw new Error("PUBLIC_QUOTE_NOT_FOUND");
  return { session: session.token, csrf: csrf.token };
}

export async function getPublicQuoteSession(
  tx: TenantTransaction,
  sessionToken: string,
) {
  const [session] = await tx
    .select()
    .from(quotePublicSessions)
    .where(eq(quotePublicSessions.sessionHash, hashPublicToken(sessionToken)))
    .limit(1);
  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw new Error("PUBLIC_QUOTE_SESSION_INVALID");
  }
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${session.tenantId}, true)`,
  );
  const [quote] = await tx
    .select()
    .from(quotes)
    .where(and(eq(quotes.tenantId, session.tenantId), eq(quotes.id, session.quoteId)))
    .limit(1);
  if (!quote || quote.status === "draft" || quote.status === "cancelled") {
    throw new Error("PUBLIC_QUOTE_NOT_AVAILABLE");
  }
  const items = await tx
    .select()
    .from(quoteItems)
    .where(
      and(
        eq(quoteItems.tenantId, session.tenantId),
        eq(quoteItems.quoteId, session.quoteId),
      ),
    )
    .orderBy(asc(quoteItems.position));
  return { quote, items };
}

export async function requestQuoteOtp(tx: TenantTransaction, sessionToken: string) {
  const [session] = await tx
    .select()
    .from(quotePublicSessions)
    .where(eq(quotePublicSessions.sessionHash, hashPublicToken(sessionToken)))
    .limit(1);
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    throw new Error("PUBLIC_QUOTE_SESSION_INVALID");
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${session.tenantId}, true)`,
  );
  const challengeCandidateId = crypto.randomUUID();
  const deliveryId = crypto.randomUUID();
  const otp = createPublicOtp("quote");
  const encrypted = encryptOtpDeliveryCode(
    otp.code,
    `otp-delivery:quote-otp:${challengeCandidateId}`,
  );
  const rows = await tx.execute(
    sql`select * from public.request_quote_otp_delivery(
      ${session.sessionHash},
      ${challengeCandidateId},
      ${deliveryId},
      ${otp.hash},
      ${encrypted.ciphertext},
      ${encrypted.nonce},
      ${encrypted.authenticationTag},
      ${encrypted.keyVersion}
    )`,
  );
  const delivery = rows[0] as
    { result?: string; challenge_id?: string; is_fresh?: boolean } | undefined;
  const challengeId = delivery?.challenge_id;
  if (delivery?.result !== "queued" || !challengeId) {
    throw new Error(`QUOTE_OTP_${delivery?.result?.toUpperCase() ?? "UNAVAILABLE"}`);
  }
  await tx.insert(quoteOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: session.tenantId,
    name: "QuoteOtpRequested.v1",
    aggregateId: session.quoteId,
    payload: {
      challengeId,
      sessionId: session.id,
      fresh: delivery.is_fresh === true,
      occurredAt: new Date().toISOString(),
    },
  });
  return shouldExposeOtpCodeForTest() && delivery.is_fresh === true
    ? { challengeId, testCode: otp.code }
    : { challengeId };
}

export async function verifyQuoteOtpForSession(
  tx: TenantTransaction,
  sessionToken: string,
  code: string,
): Promise<
  { ok: true; challengeId: string; csrf: string } | { ok: false; reason: string }
> {
  const [session] = await tx
    .select()
    .from(quotePublicSessions)
    .where(eq(quotePublicSessions.sessionHash, hashPublicToken(sessionToken)))
    .limit(1);
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    return { ok: false, reason: "session_invalid" };
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${session.tenantId}, true)`,
  );
  const csrf = createPublicSessionToken();
  const rows = await tx.execute(
    sql`select * from public.verify_quote_otp_attempt(
      ${session.sessionHash},
      ${hashPublicOtp("quote", code)},
      ${csrf.hash}
    )`,
  );
  const attempt = rows[0] as
    { result?: string; challenge_id?: string; attempts?: number } | undefined;
  const result = attempt?.result;
  if (result !== "verified" || !attempt?.challenge_id) {
    if (
      attempt?.challenge_id &&
      (result === "expired" || result === "locked" || result === "invalid")
    ) {
      await appendQuoteOtpAudit(
        tx,
        session,
        { id: attempt.challenge_id, attempts: attempt.attempts ?? 0 },
        result,
      );
    }
    return { ok: false, reason: result ?? "challenge_missing" };
  }
  await appendQuoteOtpAudit(
    tx,
    session,
    { id: attempt.challenge_id, attempts: attempt.attempts ?? 0 },
    "verified",
  );
  return { ok: true, challengeId: attempt.challenge_id, csrf: csrf.token };
}

async function appendQuoteOtpAudit(
  tx: TenantTransaction,
  session: { tenantId: string; quoteId: string; id: string },
  challenge: { id: string; attempts: number },
  result: "verified" | "invalid" | "expired" | "locked",
): Promise<void> {
  const action =
    result === "verified" ? "verified" : result === "invalid" ? "failed" : result;
  await tx.insert(quoteOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: session.tenantId,
    name: "QuoteOtpVerified.v1",
    aggregateId: session.quoteId,
    payload: {
      challengeId: challenge.id,
      sessionId: session.id,
      result: action,
      attempts: challenge.attempts,
      occurredAt: new Date().toISOString(),
    },
  });
}

export async function decidePublicQuote(
  tx: TenantTransaction,
  input: {
    sessionToken: string;
    csrfToken: string;
    fullName: string;
    consent: boolean;
    decision: "accepted" | "rejected" | "changes_requested";
    comment?: string;
    idempotencyKey: string;
  },
) {
  const [session] = await tx
    .select()
    .from(quotePublicSessions)
    .where(eq(quotePublicSessions.sessionHash, hashPublicToken(input.sessionToken)))
    .limit(1);
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    throw new Error("PUBLIC_QUOTE_SESSION_INVALID");
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${session.tenantId}, true)`,
  );
  if (!input.consent || input.fullName.trim().length < 2)
    throw new Error("QUOTE_CONSENT_REQUIRED");
  if (!constantTimeEqual(hashPublicToken(input.csrfToken), session.csrfHash))
    throw new Error("QUOTE_CSRF_INVALID");
  const existing = await tx
    .select({ id: quoteClientDecisions.id })
    .from(quoteClientDecisions)
    .where(
      and(
        eq(quoteClientDecisions.tenantId, session.tenantId),
        eq(quoteClientDecisions.quoteId, session.quoteId),
        eq(quoteClientDecisions.sessionId, session.id),
        eq(quoteClientDecisions.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing[0]) return { id: existing[0].id, repeated: true };
  const [challenge] = await tx
    .select()
    .from(quoteEmailChallenges)
    .where(
      and(
        eq(quoteEmailChallenges.tenantId, session.tenantId),
        eq(quoteEmailChallenges.sessionId, session.id),
        eq(quoteEmailChallenges.status, "verified"),
      ),
    )
    .orderBy(sql`${quoteEmailChallenges.verifiedAt} desc`)
    .limit(1);
  if (!challenge) {
    throw new Error("QUOTE_OTP_REQUIRED");
  }
  const [quote] = await tx
    .select()
    .from(quotes)
    .where(and(eq(quotes.tenantId, session.tenantId), eq(quotes.id, session.quoteId)))
    .limit(1);
  const [version] = await tx
    .select()
    .from(quoteVersions)
    .where(
      and(
        eq(quoteVersions.tenantId, session.tenantId),
        eq(quoteVersions.quoteId, session.quoteId),
      ),
    )
    .orderBy(sql`${quoteVersions.versionNumber} desc`)
    .limit(1);
  if (!quote || !version || !["issued", "viewed"].includes(quote.status))
    throw new Error("QUOTE_NOT_DECIDABLE");
  if (input.decision !== "accepted" && (input.comment?.trim().length ?? 0) < 5)
    throw new Error("QUOTE_COMMENT_REQUIRED");
  const transitionedRows = await tx.execute(
    sql`select public.apply_quote_decision_status(${session.sessionHash}, ${input.decision}) as quote_id`,
  );
  const transitioned = transitionedRows[0] as { quote_id: string | null } | undefined;
  if (!transitioned?.quote_id) {
    const [repeated] = await tx
      .select({ id: quoteClientDecisions.id })
      .from(quoteClientDecisions)
      .where(
        and(
          eq(quoteClientDecisions.tenantId, session.tenantId),
          eq(quoteClientDecisions.quoteId, session.quoteId),
          eq(quoteClientDecisions.sessionId, session.id),
          eq(quoteClientDecisions.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (repeated) return { id: repeated.id, repeated: true };
    throw new Error("QUOTE_NOT_DECIDABLE");
  }
  const id = crypto.randomUUID();
  await tx.insert(quoteClientDecisions).values({
    id,
    tenantId: session.tenantId,
    quoteId: quote.id,
    quoteVersionId: version.id,
    decision: input.decision,
    declaredFullName: input.fullName.trim(),
    emailFingerprint: challenge.emailFingerprint,
    challengeId: challenge.id,
    sessionId: session.id,
    contentHash: version.snapshotHash,
    pdfHash: version.pdfSha256,
    consentVersion: "v1",
    comment: input.comment?.trim() || null,
    idempotencyKey: input.idempotencyKey,
  });
  await tx.execute(
    sql`select public.consume_quote_email_challenge(${session.sessionHash}, ${challenge.id})`,
  );
  await tx.insert(quoteOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: session.tenantId,
    name: `QuoteClient${input.decision === "accepted" ? "Accepted" : input.decision === "rejected" ? "Rejected" : "ChangesRequested"}.v1`,
    aggregateId: quote.id,
    payload: {
      quoteId: quote.id,
      quoteVersionId: version.id,
      decision: input.decision,
      contentHash: version.snapshotHash,
    },
  });
  if (input.decision === "accepted") {
    await reconcileProjectCommercialScope(tx, {
      sessionHash: session.sessionHash,
      quoteVersionId: version.id,
      snapshotHash: version.snapshotHash,
    });
  }
  return {
    id,
    repeated: false,
    decision: input.decision,
    quoteId: quote.id,
    versionId: version.id,
  };
}

export async function revokeQuotePublicLink(
  tx: TenantTransaction,
  input: { tenantId: string; quoteId: string },
) {
  const [link] = await tx
    .select({ id: quotePublicLinks.id })
    .from(quotePublicLinks)
    .where(
      and(
        eq(quotePublicLinks.tenantId, input.tenantId),
        eq(quotePublicLinks.quoteId, input.quoteId),
        eq(quotePublicLinks.active, true),
      ),
    )
    .limit(1);
  if (!link) throw new Error("QUOTE_LINK_NOT_FOUND");
  await tx
    .update(quotePublicLinks)
    .set({ active: false })
    .where(
      and(
        eq(quotePublicLinks.tenantId, input.tenantId),
        eq(quotePublicLinks.id, link.id),
      ),
    );
  await tx
    .update(quotePublicSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(quotePublicSessions.tenantId, input.tenantId),
        eq(quotePublicSessions.quoteId, input.quoteId),
      ),
    );
  return { revoked: true };
}

export async function getQuotePdfDownload(tx: TenantTransaction, sessionToken: string) {
  const [session] = await tx
    .select()
    .from(quotePublicSessions)
    .where(eq(quotePublicSessions.sessionHash, hashPublicToken(sessionToken)))
    .limit(1);
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    throw new Error("PUBLIC_QUOTE_SESSION_INVALID");
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${session.tenantId}, true)`,
  );
  const [version] = await tx
    .select({ pdfKey: quoteVersions.pdfKey })
    .from(quoteVersions)
    .where(
      and(
        eq(quoteVersions.tenantId, session.tenantId),
        eq(quoteVersions.quoteId, session.quoteId),
      ),
    )
    .orderBy(sql`${quoteVersions.versionNumber} desc`)
    .limit(1);
  if (!version?.pdfKey) throw new Error("QUOTE_PDF_NOT_FOUND");
  return { tenantId: session.tenantId, key: version.pdfKey };
}
