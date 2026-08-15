import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { TenantTransaction } from "@/infrastructure/database/tenant";
import {
  agreementAcceptanceActions,
  agreementDrafts,
  agreementEnvelopes,
  agreementEvidenceBundles,
  agreementExternalExecutionRecords,
  agreementInternalReviews,
  agreementClauseBlocks,
  agreementClauseVersions,
  agreementTemplates,
  agreementTemplateVersions,
  internalNotifications,
  agreementNumberSequences,
  agreementOutboxEvents,
  agreementRecipientLinks,
  agreementPublicSessions,
  agreementRecipients,
  agreementVersions,
  agreements,
  quoteVersions,
  quotes,
} from "@/infrastructure/database/schema";
import { canonicalJson, sha256Canonical } from "../domain/canonical";
import {
  createCsrfToken,
  createOpaqueToken,
  createOtpForDelivery,
  hashOtp,
  hashOpaqueToken,
  hmacEvidence,
} from "../domain/crypto";
import { assertAgreementTransition, assertEnvelopeOpen } from "../domain/state";
import { renderAgreementPdf } from "./documents/agreement-pdf";
import { LocalObjectStorage } from "@/infrastructure/object-storage/local";
import { getAcceptedCommercialScope } from "@/modules/quotes/application/accepted-commercial-scope";
import {
  encryptOtpDeliveryCode,
  shouldExposeOtpCodeForTest,
} from "@/infrastructure/security/public-otp";
import { constantTimeEqual } from "@/infrastructure/security/constant-time";

type PartyInput = {
  name: string;
  email: string;
  role: string;
};

const compatibleTypes: Record<string, string[]> = {
  fixed_price: [
    "fixed_project_service_agreement",
    "signable_proposal",
    "statement_of_work",
  ],
  hourly: ["hourly_consulting_agreement", "signable_proposal", "statement_of_work"],
  retainer: ["retainer_service_agreement", "signable_proposal", "statement_of_work"],
  other: ["signable_proposal", "statement_of_work"],
};

async function unlockNextSigningRecipient(
  tx: TenantTransaction,
  input: { tenantId: string; envelopeId: string; actedRecipientId: string },
) {
  const [envelope] = await tx
    .select()
    .from(agreementEnvelopes)
    .where(
      and(
        eq(agreementEnvelopes.tenantId, input.tenantId),
        eq(agreementEnvelopes.id, input.envelopeId),
      ),
    )
    .limit(1);
  if (!envelope || envelope.signingOrder === "parallel") return;
  const remaining = (
    await tx
      .select()
      .from(agreementRecipients)
      .where(
        and(
          eq(agreementRecipients.tenantId, input.tenantId),
          eq(agreementRecipients.envelopeId, input.envelopeId),
          eq(agreementRecipients.status, "pending"),
        ),
      )
      .orderBy(sql`${agreementRecipients.signingOrder} asc`)
      .limit(1)
  )[0];
  if (!remaining) return;
  await tx
    .update(agreementRecipients)
    .set({ status: "available", availableAt: new Date() })
    .where(
      and(
        eq(agreementRecipients.tenantId, input.tenantId),
        eq(agreementRecipients.id, remaining.id),
      ),
    );
}

type AgreementActionType = "accepted" | "declined" | "changes_requested";

function agreementActionRequestHash(input: {
  agreementId: string;
  versionId: string;
  envelopeId: string;
  recipientId: string;
  actor: { kind: "public_session" | "internal_user"; id: string };
  action: AgreementActionType;
  fullName: string;
  declaredAuthority: boolean;
  consentVersion: string;
  comment: string | null;
}) {
  return sha256Canonical({
    operation: "agreement_acceptance.v1",
    resource: {
      agreementId: input.agreementId,
      versionId: input.versionId,
      envelopeId: input.envelopeId,
      recipientId: input.recipientId,
    },
    actor: input.actor,
    payload: {
      action: input.action,
      fullName: input.fullName,
      declaredAuthority: input.declaredAuthority,
      consentVersion: input.consentVersion,
      comment: input.comment,
    },
  });
}

async function findAgreementActionByIdempotency(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    envelopeId: string;
    recipientId: string;
    idempotencyKey: string;
  },
) {
  return (
    await tx
      .select({
        id: agreementAcceptanceActions.id,
        requestHash: agreementAcceptanceActions.requestHash,
        publicSessionId: agreementAcceptanceActions.publicSessionId,
        actorUserId: agreementAcceptanceActions.actorUserId,
      })
      .from(agreementAcceptanceActions)
      .where(
        and(
          eq(agreementAcceptanceActions.tenantId, input.tenantId),
          eq(agreementAcceptanceActions.envelopeId, input.envelopeId),
          eq(agreementAcceptanceActions.recipientId, input.recipientId),
          eq(agreementAcceptanceActions.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1)
  )[0];
}

function replayAgreementAction(
  existing:
    | {
        id: string;
        requestHash: string;
        publicSessionId: string | null;
        actorUserId: string | null;
      }
    | undefined,
  input: {
    requestHash: string;
    publicSessionId: string | null;
    actorUserId: string | null;
  },
) {
  if (!existing) return undefined;
  if (
    !constantTimeEqual(existing.requestHash, input.requestHash) ||
    existing.publicSessionId !== input.publicSessionId ||
    existing.actorUserId !== input.actorUserId
  ) {
    throw new Error("AGREEMENT_IDEMPOTENCY_CONFLICT");
  }
  return { id: existing.id, repeated: true };
}

function allRequiredRecipientsAccepted(
  recipients: Array<{ id: string; required: boolean; status: string }>,
  actedRecipientId: string,
) {
  return recipients.every(
    (recipient) =>
      !recipient.required ||
      recipient.id === actedRecipientId ||
      recipient.status === "accepted",
  );
}

async function completeOrAdvanceAgreementEnvelope(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    agreementId: string;
    versionId: string;
    envelopeId: string;
    recipients: Array<{ id: string; required: boolean; status: string }>;
    actedRecipientId: string;
    snapshot: Record<string, unknown>;
    documentNumber: string;
    versionNumber: number;
    contentSha256: string;
    contentPdfSha256: string | null;
  },
) {
  const allAccepted = allRequiredRecipientsAccepted(
    input.recipients,
    input.actedRecipientId,
  );
  await tx
    .update(agreementEnvelopes)
    .set({
      status: allAccepted ? "signatures_complete" : "partially_completed",
      updatedAt: new Date(),
      completedAt: allAccepted ? new Date() : null,
    })
    .where(
      and(
        eq(agreementEnvelopes.tenantId, input.tenantId),
        eq(agreementEnvelopes.id, input.envelopeId),
      ),
    );
  await tx
    .update(agreements)
    .set({
      status: allAccepted ? "signatures_complete" : "partially_accepted",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    );
  if (!allAccepted) {
    await unlockNextSigningRecipient(tx, {
      tenantId: input.tenantId,
      envelopeId: input.envelopeId,
      actedRecipientId: input.actedRecipientId,
    });
    return false;
  }
  await completeAgreementEvidence(tx, input);
  return true;
}

export async function createAgreement(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    actorUserId: string;
    ownerMembershipId: string;
    title: string;
    agreementType:
      | "fixed_project_service_agreement"
      | "hourly_consulting_agreement"
      | "retainer_service_agreement"
      | "signable_proposal"
      | "statement_of_work";
    quoteId: string;
    provider: PartyInput;
    customer: PartyInput;
  },
) {
  const scope = await getAcceptedCommercialScope(tx, {
    tenantId: input.tenantId,
    quoteId: input.quoteId,
  });
  const [source] = await tx
    .select({ quote: quotes, version: quoteVersions })
    .from(quotes)
    .innerJoin(
      quoteVersions,
      and(
        eq(quoteVersions.tenantId, quotes.tenantId),
        eq(quoteVersions.id, scope.quoteVersionId),
      ),
    )
    .where(and(eq(quotes.tenantId, input.tenantId), eq(quotes.id, input.quoteId)))
    .orderBy(sql`${quoteVersions.versionNumber} desc`)
    .limit(1);
  if (!source) throw new Error("ACCEPTED_QUOTE_REQUIRED");
  const pricingModel = String(
    (source.version.snapshot.pricingModel as string | undefined) ?? "other",
  );
  if (
    pricingModel !== "other" &&
    !compatibleTypes[pricingModel]?.includes(input.agreementType)
  ) {
    throw new Error("AGREEMENT_TYPE_INCOMPATIBLE");
  }

  const agreementId = crypto.randomUUID();
  const draftId = crypto.randomUUID();
  const parties = { provider: input.provider, customer: input.customer };
  const sections = [
    {
      type: "commercial_scope",
      title: "Alcance comercial",
      content: "Este alcance se deriva de la cotización aceptada y no es editable.",
    },
    {
      type: "deliverables",
      title: "Entregables",
      content: "EJEMPLO: completar con revisión legal del tenant.",
    },
    {
      type: "fees_and_payment",
      title: "Honorarios y pagos",
      content: "Los importes se muestran como snapshot informativo de la cotización.",
    },
    {
      type: "term",
      title: "Vigencia",
      content: "La vigencia inicia al completarse las aceptaciones requeridas.",
    },
    {
      type: "general",
      title: "Límites",
      content: "Este documento requiere revisión legal del tenant.",
    },
  ];
  await tx.insert(agreements).values({
    id: agreementId,
    tenantId: input.tenantId,
    agreementType: input.agreementType,
    status: "ready_to_issue",
    title: input.title,
    quoteId: input.quoteId,
    quoteVersionId: source.version.id,
    opportunityId: source.quote.opportunityId,
    accountId: source.quote.accountId,
    contactId: source.quote.contactId,
    ownerMembershipId: input.ownerMembershipId,
    currentDraftId: draftId,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  });
  await tx.insert(agreementDrafts).values({
    id: draftId,
    tenantId: input.tenantId,
    agreementId,
    title: input.title,
    preamble: "EJEMPLO: revisar con abogado antes de emitir.",
    documentType: input.agreementType,
    effectiveDateRule: "on_full_execution",
    term: { type: "until_scope_completion" },
    parties,
    sections,
    paymentSchedule: [],
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  });
  return { id: agreementId, draftId, quoteVersionId: source.version.id };
}

export async function listAgreements(tx: TenantTransaction, tenantId: string) {
  return tx.select().from(agreements).where(eq(agreements.tenantId, tenantId));
}

export async function listAgreementTemplates(tx: TenantTransaction, tenantId: string) {
  return tx
    .select()
    .from(agreementTemplates)
    .where(eq(agreementTemplates.tenantId, tenantId));
}

export async function createAgreementTemplate(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    userId: string;
    name: string;
    documentType:
      | "fixed_project_service_agreement"
      | "hourly_consulting_agreement"
      | "retainer_service_agreement"
      | "signable_proposal"
      | "statement_of_work";
    pricingModel: string;
    sections: Array<Record<string, unknown>>;
    variables: string[];
  },
) {
  if (input.sections.length > 60)
    throw new Error("AGREEMENT_TEMPLATE_SECTIONS_INVALID");
  const templateId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const contentHash = sha256Canonical({
    sections: input.sections,
    variables: input.variables,
  });
  await tx.insert(agreementTemplates).values({
    id: templateId,
    tenantId: input.tenantId,
    name: input.name.trim(),
    documentType: input.documentType,
    pricingModel: input.pricingModel,
    activeVersionId: versionId,
    status: "active",
    createdByUserId: input.userId,
    updatedByUserId: input.userId,
  });
  await tx.insert(agreementTemplateVersions).values({
    id: versionId,
    tenantId: input.tenantId,
    templateId,
    versionNumber: 1,
    sections: input.sections,
    variables: input.variables,
    consentText: "Acepto utilizar este medio electrónico para esta decisión.",
    contentHash,
    createdByUserId: input.userId,
  });
  return { templateId, versionId, contentHash };
}

export async function submitAgreementReview(
  tx: TenantTransaction,
  input: { tenantId: string; agreementId: string; userId: string },
) {
  const [agreement] = await tx
    .select({ status: agreements.status })
    .from(agreements)
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    )
    .limit(1);
  if (!agreement || agreement.status !== "ready_to_issue")
    throw new Error("AGREEMENT_NOT_REVIEWABLE");
  await tx
    .update(agreements)
    .set({
      status: "pending_internal_review",
      updatedByUserId: input.userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    );
  await tx.insert(agreementOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    name: "AgreementSubmittedForInternalReview.v1",
    aggregateId: input.agreementId,
    payload: { agreementId: input.agreementId },
  });
  return { status: "pending_internal_review" as const };
}

export async function reviewAgreement(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    agreementId: string;
    userId: string;
    decision: "approved" | "rejected";
    area: "commercial" | "legal_internal" | "finance";
    comment?: string;
  },
) {
  if (input.decision === "rejected" && (input.comment?.trim().length ?? 0) < 5)
    throw new Error("AGREEMENT_REVIEW_COMMENT_REQUIRED");
  const [agreement] = await tx
    .select({ status: agreements.status })
    .from(agreements)
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    )
    .limit(1);
  if (!agreement || agreement.status !== "pending_internal_review")
    throw new Error("AGREEMENT_REVIEW_NOT_PENDING");
  await tx.insert(agreementInternalReviews).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    agreementId: input.agreementId,
    versionCandidate: 1,
    area: input.area,
    decision: input.decision,
    comment: input.comment?.trim() || null,
    reviewerUserId: input.userId,
  });
  const status = input.decision === "approved" ? "ready_to_issue" : "draft";
  await tx
    .update(agreements)
    .set({ status, updatedByUserId: input.userId, updatedAt: new Date() })
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    );
  await tx.insert(agreementOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    name:
      input.decision === "approved"
        ? "AgreementInternallyApproved.v1"
        : "AgreementInternallyRejected.v1",
    aggregateId: input.agreementId,
    payload: { agreementId: input.agreementId, area: input.area },
  });
  return { status };
}

export async function createAgreementNotification(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    membershipId: string;
    agreementId: string;
    type: string;
    title: string;
    bodyText: string;
  },
) {
  await tx
    .insert(internalNotifications)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      membershipId: input.membershipId,
      type: input.type,
      severity: "info",
      title: input.title,
      bodyText: input.bodyText,
      resourceType: "agreement",
      resourceId: input.agreementId,
      dedupeKey: `${input.type}:${input.agreementId}:${input.membershipId}`,
    })
    .onConflictDoNothing();
}

export async function recordExternalPdf(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    agreementId: string;
    versionId: string;
    userId: string;
    storageKey: string;
    fileSha256: string;
    sizeBytes: number;
  },
) {
  const [agreement] = await tx
    .select({
      id: agreements.id,
      status: agreements.status,
      currentVersionId: agreements.currentVersionId,
      activeEnvelopeId: agreements.activeEnvelopeId,
    })
    .from(agreements)
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    )
    .limit(1);
  if (!agreement || !["issued", "partially_accepted"].includes(agreement.status))
    throw new Error("AGREEMENT_NOT_UPLOADABLE");
  if (!agreement.currentVersionId || !agreement.activeEnvelopeId)
    throw new Error("AGREEMENT_NOT_READY");
  const [envelope] = await tx
    .select()
    .from(agreementEnvelopes)
    .where(
      and(
        eq(agreementEnvelopes.tenantId, input.tenantId),
        eq(agreementEnvelopes.id, agreement.activeEnvelopeId),
        eq(agreementEnvelopes.agreementId, agreement.id),
        eq(agreementEnvelopes.versionId, input.versionId),
      ),
    )
    .for("update")
    .limit(1);
  if (!envelope || envelope.method !== "external_signed_pdf")
    throw new Error("AGREEMENT_EXTERNAL_METHOD_REQUIRED");
  if (envelope.expiresAt <= new Date()) throw new Error("AGREEMENT_ENVELOPE_EXPIRED");
  assertEnvelopeOpen(envelope.status);
  const [version] = await tx
    .select({ id: agreementVersions.id })
    .from(agreementVersions)
    .where(
      and(
        eq(agreementVersions.tenantId, input.tenantId),
        eq(agreementVersions.id, input.versionId),
        eq(agreementVersions.agreementId, agreement.id),
      ),
    )
    .limit(1);
  if (!version || agreement.currentVersionId !== version.id)
    throw new Error("AGREEMENT_VERSION_NOT_FOUND");
  const [record] = await tx
    .insert(agreementExternalExecutionRecords)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      agreementId: input.agreementId,
      versionId: input.versionId,
      storageKey: input.storageKey,
      fileSha256: input.fileSha256,
      sizeBytes: input.sizeBytes,
      mimeType: "application/pdf",
      uploadedByUserId: input.userId,
    })
    .returning({
      id: agreementExternalExecutionRecords.id,
      status: agreementExternalExecutionRecords.reviewStatus,
    });
  return record;
}

export async function verifyExternalPdf(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    agreementId: string;
    recordId: string;
    reviewerUserId: string;
    comment: string;
  },
) {
  const [candidate] = await tx
    .select({
      agreementId: agreementExternalExecutionRecords.agreementId,
      versionId: agreementExternalExecutionRecords.versionId,
    })
    .from(agreementExternalExecutionRecords)
    .where(
      and(
        eq(agreementExternalExecutionRecords.tenantId, input.tenantId),
        eq(agreementExternalExecutionRecords.id, input.recordId),
        eq(agreementExternalExecutionRecords.agreementId, input.agreementId),
      ),
    )
    .limit(1);
  if (!candidate) throw new Error("EXTERNAL_EVIDENCE_NOT_REVIEWABLE");
  const [agreement] = await tx
    .select({
      activeEnvelopeId: agreements.activeEnvelopeId,
      currentVersionId: agreements.currentVersionId,
    })
    .from(agreements)
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    )
    .limit(1);
  if (!agreement?.activeEnvelopeId || !agreement.currentVersionId)
    throw new Error("AGREEMENT_NOT_READY");
  const [envelope] = await tx
    .select()
    .from(agreementEnvelopes)
    .where(
      and(
        eq(agreementEnvelopes.tenantId, input.tenantId),
        eq(agreementEnvelopes.id, agreement.activeEnvelopeId),
        eq(agreementEnvelopes.agreementId, input.agreementId),
        eq(agreementEnvelopes.versionId, candidate.versionId),
      ),
    )
    .for("update")
    .limit(1);
  if (!envelope || envelope.method !== "external_signed_pdf")
    throw new Error("AGREEMENT_ENVELOPE_NOT_FOUND");
  if (envelope.expiresAt <= new Date()) throw new Error("AGREEMENT_ENVELOPE_EXPIRED");
  const [record] = await tx
    .select()
    .from(agreementExternalExecutionRecords)
    .where(
      and(
        eq(agreementExternalExecutionRecords.tenantId, input.tenantId),
        eq(agreementExternalExecutionRecords.id, input.recordId),
        eq(agreementExternalExecutionRecords.agreementId, input.agreementId),
      ),
    )
    .for("update")
    .limit(1);
  if (!record || record.reviewStatus !== "pending")
    throw new Error("EXTERNAL_EVIDENCE_NOT_REVIEWABLE");
  if (record.uploadedByUserId === input.reviewerUserId)
    throw new Error("EXTERNAL_REVIEW_SEPARATION_REQUIRED");
  const [version] = await tx
    .select()
    .from(agreementVersions)
    .where(
      and(
        eq(agreementVersions.tenantId, input.tenantId),
        eq(agreementVersions.id, record.versionId),
        eq(agreementVersions.agreementId, input.agreementId),
      ),
    )
    .limit(1);
  if (!version || agreement.currentVersionId !== version.id)
    throw new Error("AGREEMENT_VERSION_NOT_FOUND");
  assertEnvelopeOpen(envelope.status);
  const evidence = {
    schemaVersion: 1,
    agreementId: record.agreementId,
    versionId: record.versionId,
    externalPdfSha256: record.fileSha256,
    review: { reviewerUserId: input.reviewerUserId, comment: input.comment.trim() },
  };
  const evidenceSha256 = sha256Canonical(evidence);
  const master =
    process.env.AGREEMENT_EVIDENCE_HMAC_KEY ?? "test-agreement-evidence-key";
  const evidenceSeal = hmacEvidence(
    canonicalJson(evidence),
    hmacEvidence(`tenant:${input.tenantId}`, master),
  );
  await tx
    .update(agreementExternalExecutionRecords)
    .set({
      reviewStatus: "verified",
      reviewedByUserId: input.reviewerUserId,
      reviewerComment: input.comment.trim(),
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(agreementExternalExecutionRecords.tenantId, input.tenantId),
        eq(agreementExternalExecutionRecords.id, input.recordId),
      ),
    );
  await tx.insert(agreementEvidenceBundles).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    agreementId: record.agreementId,
    versionId: record.versionId,
    envelopeId: envelope.id,
    status: "sealed",
    canonicalEvidence: evidence,
    evidenceSha256,
    keyVersion: Number(process.env.AGREEMENT_EVIDENCE_KEY_VERSION ?? "1"),
    evidenceSeal,
    finalPdfKey: record.storageKey,
    finalPdfSha256: record.fileSha256,
    completedAt: new Date(),
  });
  await tx
    .update(agreementEnvelopes)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(agreementEnvelopes.tenantId, input.tenantId),
        eq(agreementEnvelopes.id, envelope.id),
      ),
    );
  await tx
    .update(agreements)
    .set({
      status: "executed",
      executedVersionId: record.versionId,
      executionMethod: "external_signed_pdf",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, record.agreementId),
      ),
    );
  await tx.insert(agreementOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    name: "AgreementExecuted.v1",
    aggregateId: record.agreementId,
    payload: {
      agreementId: record.agreementId,
      versionId: record.versionId,
      executionMethod: "external_signed_pdf",
      contentSha256: version.contentSha256,
      evidenceSha256,
      finalPdfSha256: record.fileSha256,
    },
  });
  return { agreementId: record.agreementId, evidenceSha256 };
}

export async function acceptAgreementInternally(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    agreementId: string;
    membershipId: string;
    userId: string;
    fullName: string;
    idempotencyKey: string;
  },
) {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("ACCEPTANCE_FIELDS_REQUIRED");
  const [agreement] = await tx
    .select()
    .from(agreements)
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    )
    .limit(1);
  if (!agreement?.activeEnvelopeId || !agreement.currentVersionId)
    throw new Error("AGREEMENT_NOT_READY");
  const [envelope] = await tx
    .select()
    .from(agreementEnvelopes)
    .where(
      and(
        eq(agreementEnvelopes.tenantId, input.tenantId),
        eq(agreementEnvelopes.id, agreement.activeEnvelopeId),
        eq(agreementEnvelopes.agreementId, agreement.id),
        eq(agreementEnvelopes.versionId, agreement.currentVersionId),
      ),
    )
    .for("update")
    .limit(1);
  if (!envelope) throw new Error("AGREEMENT_NOT_FOUND");
  const recipients = await tx
    .select()
    .from(agreementRecipients)
    .where(
      and(
        eq(agreementRecipients.tenantId, input.tenantId),
        eq(agreementRecipients.envelopeId, envelope.id),
      ),
    )
    .orderBy(sql`${agreementRecipients.id} asc`)
    .for("update");
  const recipient = recipients.find(
    (candidate) =>
      candidate.membershipId === input.membershipId &&
      candidate.recipientType === "internal_member",
  );
  if (!recipient) throw new Error("INTERNAL_RECIPIENT_NOT_AVAILABLE");
  const requestHash = agreementActionRequestHash({
    agreementId: agreement.id,
    versionId: envelope.versionId,
    envelopeId: envelope.id,
    recipientId: recipient.id,
    actor: { kind: "internal_user", id: input.userId },
    action: "accepted",
    fullName,
    declaredAuthority: true,
    consentVersion: "v1",
    comment: null,
  });
  const replay = replayAgreementAction(
    await findAgreementActionByIdempotency(tx, {
      tenantId: input.tenantId,
      envelopeId: envelope.id,
      recipientId: recipient.id,
      idempotencyKey: input.idempotencyKey,
    }),
    { requestHash, publicSessionId: null, actorUserId: input.userId },
  );
  if (replay)
    return {
      ...replay,
      signaturesComplete:
        envelope.status === "signatures_complete" || envelope.status === "completed",
    };
  assertEnvelopeOpen(envelope.status);
  if (envelope.expiresAt <= new Date()) throw new Error("AGREEMENT_ENVELOPE_EXPIRED");
  if (envelope.method !== "internal_electronic_acceptance")
    throw new Error("AGREEMENT_EXTERNAL_METHOD_REQUIRED");
  if (!["available", "viewed"].includes(recipient.status))
    throw new Error("INTERNAL_RECIPIENT_NOT_AVAILABLE");
  const [version] = await tx
    .select()
    .from(agreementVersions)
    .where(
      and(
        eq(agreementVersions.tenantId, input.tenantId),
        eq(agreementVersions.id, envelope.versionId),
        eq(agreementVersions.agreementId, agreement.id),
      ),
    )
    .limit(1);
  if (!version || agreement.currentVersionId !== version.id)
    throw new Error("AGREEMENT_NOT_FOUND");
  const actionId = crypto.randomUUID();
  await tx.insert(agreementAcceptanceActions).values({
    id: actionId,
    tenantId: input.tenantId,
    agreementId: agreement.id,
    versionId: version.id,
    envelopeId: envelope.id,
    recipientId: recipient.id,
    action: "accepted",
    actorKind: "internal_member",
    declaredFullName: fullName,
    declaredAuthority: true,
    consentVersion: "v1",
    consentHash: hashOpaqueToken("agreement-consent-v1"),
    contentSha256: version.contentSha256,
    contentPdfSha256: version.contentPdfSha256,
    emailFingerprint: hashOpaqueToken(input.userId),
    idempotencyKey: input.idempotencyKey,
    requestHash,
    actorUserId: input.userId,
  });
  await tx
    .update(agreementRecipients)
    .set({ status: "accepted", actedAt: new Date() })
    .where(
      and(
        eq(agreementRecipients.tenantId, input.tenantId),
        eq(agreementRecipients.id, recipient.id),
      ),
    );
  const signaturesComplete = await completeOrAdvanceAgreementEnvelope(tx, {
    tenantId: input.tenantId,
    agreementId: agreement.id,
    versionId: version.id,
    envelopeId: envelope.id,
    recipients,
    actedRecipientId: recipient.id,
    snapshot: version.snapshot,
    documentNumber: version.documentNumber,
    versionNumber: version.versionNumber,
    contentSha256: version.contentSha256,
    contentPdfSha256: version.contentPdfSha256,
  });
  return {
    id: actionId,
    repeated: false,
    signaturesComplete,
  };
}

export async function issueAgreement(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    agreementId: string;
    actorUserId: string;
    method: "internal_electronic_acceptance" | "external_signed_pdf";
    signingOrder: "provider_first" | "customer_first" | "parallel";
  },
) {
  const [agreement] = await tx
    .select()
    .from(agreements)
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    )
    .limit(1);
  if (!agreement) throw new Error("AGREEMENT_NOT_FOUND");
  assertAgreementTransition(agreement.status, "issued");
  const [draft] = await tx
    .select()
    .from(agreementDrafts)
    .where(
      and(
        eq(agreementDrafts.tenantId, input.tenantId),
        eq(agreementDrafts.id, agreement.currentDraftId!),
      ),
    )
    .limit(1);
  if (!draft) throw new Error("AGREEMENT_DRAFT_NOT_FOUND");
  const [source] = await tx
    .select({ quote: quotes, version: quoteVersions })
    .from(quotes)
    .innerJoin(
      quoteVersions,
      and(
        eq(quoteVersions.tenantId, quotes.tenantId),
        eq(quoteVersions.id, agreement.quoteVersionId),
      ),
    )
    .where(
      and(
        eq(quotes.tenantId, input.tenantId),
        eq(quotes.id, agreement.quoteId),
        eq(quotes.status, "accepted"),
      ),
    )
    .limit(1);
  if (
    !source ||
    source.version.snapshotHash !== sha256Canonical(source.version.snapshot)
  ) {
    throw new Error("AGREEMENT_SCOPE_HASH_INVALID");
  }
  const now = new Date();
  const year = now.getUTCFullYear();
  await tx
    .insert(agreementNumberSequences)
    .values({ tenantId: input.tenantId, year })
    .onConflictDoNothing();
  const sequenceRows = await tx.execute(
    sql`select prefix, next_value from agreement_number_sequences where tenant_id = ${input.tenantId} and year = ${year} for update`,
  );
  const sequence = sequenceRows[0] as
    { prefix: string; next_value: number } | undefined;
  if (!sequence) throw new Error("AGREEMENT_NUMBER_SEQUENCE_UNAVAILABLE");
  await tx
    .update(agreementNumberSequences)
    .set({ nextValue: sequence.next_value + 1, updatedAt: now })
    .where(
      and(
        eq(agreementNumberSequences.tenantId, input.tenantId),
        eq(agreementNumberSequences.year, year),
      ),
    );
  const documentNumber = `${sequence.prefix}-${year}-${String(sequence.next_value).padStart(4, "0")}`;
  const snapshot = {
    title: draft.title,
    documentType: draft.documentType,
    parties: draft.parties,
    sections: draft.sections,
    term: draft.term,
    paymentSchedule: draft.paymentSchedule,
    commercialScope: source.version.snapshot,
  };
  const contentSha256 = sha256Canonical(snapshot);
  const versionId = crypto.randomUUID();
  const pdf = await renderAgreementPdf({
    title: draft.title,
    documentNumber,
    version: 1,
    contentHash: contentSha256,
    providerName: String((draft.parties.provider as PartyInput).name),
    customerName: String((draft.parties.customer as PartyInput).name),
    sections: draft.sections.map((section) => ({
      title: String(section.title),
      content: String(section.content),
    })),
  });
  const storage = new LocalObjectStorage();
  const stored = await storage.put({
    tenantId: input.tenantId,
    key: `agreements/${agreement.id}/${versionId}/content.pdf`,
    body: pdf,
    contentType: "application/pdf",
  });
  await tx.insert(agreementVersions).values({
    id: versionId,
    tenantId: input.tenantId,
    agreementId: agreement.id,
    versionNumber: 1,
    documentNumber,
    status: "issued",
    sourceQuoteId: agreement.quoteId,
    sourceQuoteVersionId: agreement.quoteVersionId,
    sourceQuoteHash: source.version.snapshotHash,
    snapshot,
    contentSha256,
    contentPdfKey: stored.key,
    contentPdfSha256: stored.sha256,
    rendererVersion: "agreement-pdf-v1",
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    createdByUserId: input.actorUserId,
  });
  const envelopeId = crypto.randomUUID();
  await tx.insert(agreementEnvelopes).values({
    id: envelopeId,
    tenantId: input.tenantId,
    agreementId: agreement.id,
    versionId,
    method: input.method,
    signingOrder: input.signingOrder,
    expiresAt: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    senderMembershipId: agreement.ownerMembershipId,
  });
  const parties = draft.parties as { provider: PartyInput; customer: PartyInput };
  const publicTokens: string[] = [];
  for (const [side, party] of [
    ["provider", parties.provider],
    ["customer", parties.customer],
  ] as const) {
    const recipientId = crypto.randomUUID();
    const isProvider = side === "provider";
    const available =
      input.signingOrder === "parallel" ||
      (input.signingOrder === "provider_first" ? isProvider : !isProvider);
    await tx.insert(agreementRecipients).values({
      id: recipientId,
      tenantId: input.tenantId,
      envelopeId,
      partySide: side,
      recipientType: isProvider ? "internal_member" : "external_contact",
      membershipId: isProvider ? agreement.ownerMembershipId : null,
      contactId: isProvider ? null : agreement.contactId,
      nameSnapshot: party.name,
      emailSnapshot: party.email,
      roleSnapshot: party.role,
      signingOrder: isProvider ? 1 : 2,
      status: available ? "available" : "pending",
      availableAt: available ? now : null,
    });
    if (!isProvider) {
      const token = createOpaqueToken();
      publicTokens.push(token.token);
      await tx.insert(agreementRecipientLinks).values({
        id: crypto.randomUUID(),
        tenantId: input.tenantId,
        recipientId,
        tokenHash: token.hash,
        expiresAt: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        generation: 1,
      });
    }
  }
  await tx
    .update(agreements)
    .set({
      number: documentNumber,
      status: "issued",
      currentVersionId: versionId,
      activeEnvelopeId: envelopeId,
      executionMethod: input.method,
      updatedByUserId: input.actorUserId,
      updatedAt: now,
    })
    .where(
      and(eq(agreements.tenantId, input.tenantId), eq(agreements.id, agreement.id)),
    );
  await tx.insert(agreementOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    name: "AgreementIssued.v1",
    aggregateId: agreement.id,
    payload: {
      agreementId: agreement.id,
      versionId,
      documentNumber,
      method: input.method,
      contentSha256,
    },
  });
  return {
    agreementId: agreement.id,
    versionId,
    envelopeId,
    documentNumber,
    contentSha256,
    publicTokens,
  };
}

export async function exchangeAgreementLink(tx: TenantTransaction, token: string) {
  const [link] = await tx
    .update(agreementRecipientLinks)
    .set({ active: false, revokedAt: new Date() })
    .where(
      and(
        eq(agreementRecipientLinks.tokenHash, hashOpaqueToken(token)),
        eq(agreementRecipientLinks.active, true),
        gt(agreementRecipientLinks.expiresAt, new Date()),
        isNull(agreementRecipientLinks.revokedAt),
      ),
    )
    .returning({
      tenantId: agreementRecipientLinks.tenantId,
      recipientId: agreementRecipientLinks.recipientId,
    });
  if (!link) throw new Error("AGREEMENT_LINK_INVALID");
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${link.tenantId}, true)`,
  );
  const [recipient] = await tx
    .select()
    .from(agreementRecipients)
    .where(
      and(
        eq(agreementRecipients.tenantId, link.tenantId),
        eq(agreementRecipients.id, link.recipientId),
      ),
    )
    .limit(1);
  if (
    !recipient ||
    recipient.recipientType !== "external_contact" ||
    !["available", "viewed"].includes(recipient.status)
  )
    throw new Error("AGREEMENT_RECIPIENT_NOT_AVAILABLE");
  const session = createOpaqueToken();
  const csrf = createCsrfToken();
  await tx.insert(agreementPublicSessions).values({
    id: crypto.randomUUID(),
    tenantId: link.tenantId,
    recipientId: link.recipientId,
    sessionHash: session.hash,
    csrfHash: csrf.hash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await tx
    .update(agreementRecipients)
    .set({ status: "viewed", viewedAt: new Date() })
    .where(
      and(
        eq(agreementRecipients.tenantId, link.tenantId),
        eq(agreementRecipients.id, link.recipientId),
      ),
    );
  return {
    session: session.token,
    csrf: csrf.token,
    tenantId: link.tenantId,
    recipientId: link.recipientId,
  };
}

async function getSession(tx: TenantTransaction, sessionToken: string) {
  const [session] = await tx
    .select()
    .from(agreementPublicSessions)
    .where(eq(agreementPublicSessions.sessionHash, hashOpaqueToken(sessionToken)))
    .limit(1);
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    throw new Error("AGREEMENT_SESSION_INVALID");
  await tx.execute(
    sql`select set_config('app.current_tenant_id', ${session.tenantId}, true)`,
  );
  return session;
}

export async function requestAgreementOtp(tx: TenantTransaction, sessionToken: string) {
  const session = await getSession(tx, sessionToken);
  const deliveryId = crypto.randomUUID();
  const otp = createOtpForDelivery();
  const encrypted = encryptOtpDeliveryCode(
    otp.code,
    `otp-delivery:agreement-otp:${session.id}`,
  );
  const rows = await tx.execute(
    sql`select * from public.request_agreement_otp_delivery(
      ${session.sessionHash},
      ${deliveryId},
      ${otp.hash},
      ${encrypted.ciphertext},
      ${encrypted.nonce},
      ${encrypted.authenticationTag},
      ${encrypted.keyVersion}
    )`,
  );
  const delivery = rows[0] as { result?: string; is_fresh?: boolean } | undefined;
  if (delivery?.result !== "queued") {
    throw new Error(
      `AGREEMENT_OTP_${delivery?.result?.toUpperCase() ?? "UNAVAILABLE"}`,
    );
  }
  await tx.insert(agreementOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: session.tenantId,
    name: "AgreementOtpRequested.v1",
    aggregateId: session.recipientId,
    payload: {
      sessionId: session.id,
      fresh: delivery.is_fresh === true,
      occurredAt: new Date().toISOString(),
    },
  });
  return shouldExposeOtpCodeForTest() && delivery.is_fresh === true
    ? otp.code
    : undefined;
}

export async function getAgreementPublicView(
  tx: TenantTransaction,
  sessionToken: string,
) {
  const session = await getSession(tx, sessionToken);
  const [recipient] = await tx
    .select()
    .from(agreementRecipients)
    .where(
      and(
        eq(agreementRecipients.tenantId, session.tenantId),
        eq(agreementRecipients.id, session.recipientId),
      ),
    )
    .limit(1);
  if (!recipient) throw new Error("AGREEMENT_RECIPIENT_NOT_FOUND");
  const [envelope] = await tx
    .select()
    .from(agreementEnvelopes)
    .where(
      and(
        eq(agreementEnvelopes.tenantId, session.tenantId),
        eq(agreementEnvelopes.id, recipient.envelopeId),
      ),
    )
    .limit(1);
  if (!envelope) throw new Error("AGREEMENT_ENVELOPE_NOT_FOUND");
  const [version] = await tx
    .select()
    .from(agreementVersions)
    .where(
      and(
        eq(agreementVersions.tenantId, session.tenantId),
        eq(agreementVersions.id, envelope.versionId),
      ),
    )
    .limit(1);
  const [agreement] = await tx
    .select()
    .from(agreements)
    .where(
      and(
        eq(agreements.tenantId, session.tenantId),
        eq(agreements.id, envelope.agreementId),
      ),
    )
    .limit(1);
  if (!version || !agreement) throw new Error("AGREEMENT_NOT_FOUND");
  const now = new Date();
  const envelopeOpen = ["ready", "sent", "partially_completed"].includes(
    envelope.status,
  );
  const recipientAvailable = ["available", "viewed"].includes(recipient.status);
  const otpNextRequestAt = session.otpLastSentAt
    ? new Date(session.otpLastSentAt.getTime() + 60_000)
    : null;
  const electronicActionAvailable =
    envelope.method === "internal_electronic_acceptance" &&
    envelopeOpen &&
    recipientAvailable &&
    envelope.expiresAt > now;
  return {
    agreement: {
      number: agreement.number,
      title: agreement.title,
      status: agreement.status,
    },
    version: {
      documentNumber: version.documentNumber,
      versionNumber: version.versionNumber,
      snapshot: version.snapshot,
      contentSha256: version.contentSha256,
    },
    recipient: {
      name: recipient.nameSnapshot,
      role: recipient.roleSnapshot,
      status: recipient.status,
    },
    envelope: {
      status: envelope.status,
      signingOrder: envelope.signingOrder,
      method: envelope.method,
      expiresAt: envelope.expiresAt.toISOString(),
    },
    session: {
      verified: session.verifiedAt !== null,
      otpLocked: session.otpLockedAt !== null,
      otpNextRequestAt: otpNextRequestAt?.toISOString() ?? null,
      expiresAt: session.expiresAt.toISOString(),
      canRequestOtp:
        electronicActionAvailable && !session.verifiedAt && !session.otpLockedAt,
      canAct: electronicActionAvailable && Boolean(session.verifiedAt),
    },
  };
}

export async function verifyAgreementOtp(
  tx: TenantTransaction,
  sessionToken: string,
  code: string,
): Promise<{ ok: boolean; reason?: string; csrf?: string }> {
  const session = await getSession(tx, sessionToken);
  const csrf = createCsrfToken();
  const rows = await tx.execute(
    sql`select * from public.verify_agreement_otp_attempt(
      ${session.sessionHash},
      ${hashOtp(code)},
      ${csrf.hash}
    )`,
  );
  const attempt = rows[0] as { result?: string; attempts?: number } | undefined;
  if (attempt?.result !== "verified") {
    if (attempt?.result === "invalid") {
      await appendAgreementOtpAudit(tx, session, "failed", attempt.attempts ?? 0);
    } else if (attempt?.result === "locked") {
      await appendAgreementOtpAudit(tx, session, "locked", attempt.attempts ?? 0);
    } else if (attempt?.result === "expired") {
      await appendAgreementOtpAudit(tx, session, "expired", attempt.attempts ?? 0);
    }
    return { ok: false, reason: attempt?.result ?? "expired" };
  }
  await appendAgreementOtpAudit(tx, session, "verified", attempt.attempts ?? 0);
  return { ok: true, csrf: csrf.token };
}

async function appendAgreementOtpAudit(
  tx: TenantTransaction,
  session: { tenantId: string; recipientId: string; id: string },
  result: "verified" | "failed" | "locked" | "expired",
  attempts: number,
): Promise<void> {
  await tx.insert(agreementOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: session.tenantId,
    name: "AgreementOtpVerified.v1",
    aggregateId: session.recipientId,
    payload: {
      sessionId: session.id,
      result,
      attempts,
      occurredAt: new Date().toISOString(),
    },
  });
}

export async function acceptAgreementPublicly(
  tx: TenantTransaction,
  input: {
    sessionToken: string;
    csrfToken: string;
    fullName: string;
    declaredAuthority: boolean;
    consent: boolean;
    idempotencyKey: string;
    action: "accepted" | "declined" | "changes_requested";
    comment?: string;
  },
) {
  const session = await getSession(tx, input.sessionToken);
  const fullName = input.fullName.trim();
  const comment = input.comment?.trim() || null;
  if (!session.verifiedAt || !input.consent || !fullName)
    throw new Error("AGREEMENT_CONSENT_REQUIRED");
  if (!constantTimeEqual(hashOpaqueToken(input.csrfToken), session.csrfHash))
    throw new Error("AGREEMENT_CSRF_INVALID");
  const [sessionRecipient] = await tx
    .select()
    .from(agreementRecipients)
    .where(
      and(
        eq(agreementRecipients.tenantId, session.tenantId),
        eq(agreementRecipients.id, session.recipientId),
      ),
    )
    .limit(1);
  if (!sessionRecipient) throw new Error("AGREEMENT_RECIPIENT_NOT_AVAILABLE");
  const [envelope] = await tx
    .select()
    .from(agreementEnvelopes)
    .where(
      and(
        eq(agreementEnvelopes.tenantId, session.tenantId),
        eq(agreementEnvelopes.id, sessionRecipient.envelopeId),
      ),
    )
    .for("update")
    .limit(1);
  if (!envelope) throw new Error("AGREEMENT_ENVELOPE_NOT_FOUND");
  const recipients = await tx
    .select()
    .from(agreementRecipients)
    .where(
      and(
        eq(agreementRecipients.tenantId, session.tenantId),
        eq(agreementRecipients.envelopeId, envelope.id),
      ),
    )
    .orderBy(sql`${agreementRecipients.id} asc`)
    .for("update");
  const recipient = recipients.find(
    (candidate) => candidate.id === session.recipientId,
  );
  if (!recipient || recipient.recipientType !== "external_contact")
    throw new Error("AGREEMENT_RECIPIENT_NOT_AVAILABLE");
  const requestHash = agreementActionRequestHash({
    agreementId: envelope.agreementId,
    versionId: envelope.versionId,
    envelopeId: envelope.id,
    recipientId: recipient.id,
    actor: { kind: "public_session", id: session.id },
    action: input.action,
    fullName,
    declaredAuthority: input.declaredAuthority,
    consentVersion: "v1",
    comment,
  });
  const replay = replayAgreementAction(
    await findAgreementActionByIdempotency(tx, {
      tenantId: session.tenantId,
      envelopeId: envelope.id,
      recipientId: recipient.id,
      idempotencyKey: input.idempotencyKey,
    }),
    { requestHash, publicSessionId: session.id, actorUserId: null },
  );
  if (replay)
    return {
      ...replay,
      signaturesComplete:
        envelope.status === "signatures_complete" || envelope.status === "completed",
    };
  assertEnvelopeOpen(envelope.status);
  if (envelope.expiresAt <= new Date()) throw new Error("AGREEMENT_ENVELOPE_EXPIRED");
  if (envelope.method !== "internal_electronic_acceptance")
    throw new Error("AGREEMENT_EXTERNAL_METHOD_REQUIRED");
  if (!["available", "viewed"].includes(recipient.status))
    throw new Error("AGREEMENT_RECIPIENT_NOT_AVAILABLE");
  if (!input.declaredAuthority) throw new Error("AGREEMENT_AUTHORITY_REQUIRED");
  const [version] = await tx
    .select()
    .from(agreementVersions)
    .where(
      and(
        eq(agreementVersions.tenantId, session.tenantId),
        eq(agreementVersions.id, envelope.versionId),
        eq(agreementVersions.agreementId, envelope.agreementId),
      ),
    )
    .limit(1);
  const [agreement] = await tx
    .select()
    .from(agreements)
    .where(
      and(
        eq(agreements.tenantId, session.tenantId),
        eq(agreements.id, envelope.agreementId),
      ),
    )
    .limit(1);
  if (
    !version ||
    !agreement ||
    agreement.activeEnvelopeId !== envelope.id ||
    agreement.currentVersionId !== version.id
  )
    throw new Error("AGREEMENT_NOT_FOUND");
  const actionId = crypto.randomUUID();
  await tx.insert(agreementAcceptanceActions).values({
    id: actionId,
    tenantId: session.tenantId,
    agreementId: agreement.id,
    versionId: version.id,
    envelopeId: envelope.id,
    recipientId: recipient.id,
    action: input.action,
    actorKind: "external_contact",
    declaredFullName: fullName,
    declaredAuthority: input.declaredAuthority,
    consentVersion: "v1",
    consentHash: hashOpaqueToken("agreement-consent-v1"),
    contentSha256: version.contentSha256,
    contentPdfSha256: version.contentPdfSha256,
    emailFingerprint: hashOpaqueToken(recipient.emailSnapshot),
    comment,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    publicSessionId: session.id,
  });
  if (input.action !== "accepted") {
    await tx
      .update(agreementRecipients)
      .set({ status: input.action })
      .where(
        and(
          eq(agreementRecipients.tenantId, session.tenantId),
          eq(agreementRecipients.id, recipient.id),
        ),
      );
    await tx
      .update(agreementEnvelopes)
      .set({
        status: input.action === "declined" ? "declined" : "changes_requested",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agreementEnvelopes.tenantId, envelope.tenantId),
          eq(agreementEnvelopes.id, envelope.id),
        ),
      );
    await tx
      .update(agreements)
      .set({
        status: input.action === "declined" ? "declined" : "changes_requested",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agreements.tenantId, agreement.tenantId),
          eq(agreements.id, agreement.id),
        ),
      );
    return { id: actionId, repeated: false, signaturesComplete: false };
  }
  await tx
    .update(agreementRecipients)
    .set({ status: "accepted", actedAt: new Date() })
    .where(
      and(
        eq(agreementRecipients.tenantId, session.tenantId),
        eq(agreementRecipients.id, recipient.id),
      ),
    );
  const signaturesComplete = await completeOrAdvanceAgreementEnvelope(tx, {
    tenantId: session.tenantId,
    agreementId: agreement.id,
    versionId: version.id,
    envelopeId: envelope.id,
    recipients,
    actedRecipientId: recipient.id,
    snapshot: version.snapshot,
    documentNumber: version.documentNumber,
    versionNumber: version.versionNumber,
    contentSha256: version.contentSha256,
    contentPdfSha256: version.contentPdfSha256,
  });
  return { id: actionId, repeated: false, signaturesComplete };
}

async function completeAgreementEvidence(
  tx: TenantTransaction,
  input: {
    tenantId: string;
    agreementId: string;
    versionId: string;
    envelopeId: string;
    snapshot: Record<string, unknown>;
    documentNumber: string;
    versionNumber: number;
    contentSha256: string;
    contentPdfSha256: string | null;
  },
) {
  const actions = await tx
    .select({
      id: agreementAcceptanceActions.id,
      action: agreementAcceptanceActions.action,
      recipientId: agreementAcceptanceActions.recipientId,
      declaredFullName: agreementAcceptanceActions.declaredFullName,
      consentVersion: agreementAcceptanceActions.consentVersion,
      consentHash: agreementAcceptanceActions.consentHash,
      occurredAt: agreementAcceptanceActions.occurredAt,
      emailFingerprint: agreementAcceptanceActions.emailFingerprint,
      requestHash: agreementAcceptanceActions.requestHash,
      publicSessionId: agreementAcceptanceActions.publicSessionId,
      actorUserId: agreementAcceptanceActions.actorUserId,
    })
    .from(agreementAcceptanceActions)
    .where(
      and(
        eq(agreementAcceptanceActions.tenantId, input.tenantId),
        eq(agreementAcceptanceActions.envelopeId, input.envelopeId),
      ),
    )
    .orderBy(agreementAcceptanceActions.occurredAt, agreementAcceptanceActions.id);
  const canonicalEvidence = {
    schemaVersion: 1,
    agreementId: input.agreementId,
    versionId: input.versionId,
    envelopeId: input.envelopeId,
    contentSha256: input.contentSha256,
    contentPdfSha256: input.contentPdfSha256,
    actions: actions.map((action) => ({
      ...action,
      occurredAt: action.occurredAt.toISOString(),
    })),
  };
  const evidenceSha256 = sha256Canonical(canonicalEvidence);
  const master =
    process.env.AGREEMENT_EVIDENCE_HMAC_KEY ?? "test-agreement-evidence-key";
  const tenantKey = hmacEvidence(`tenant:${input.tenantId}`, master);
  const evidenceSeal = hmacEvidence(canonicalJson(canonicalEvidence), tenantKey);
  const sections =
    (input.snapshot.sections as Array<{ title: string; content: string }>) ?? [];
  const parties = input.snapshot.parties as
    { provider?: PartyInput; customer?: PartyInput } | undefined;
  const pdf = await renderAgreementPdf({
    title: String(input.snapshot.title),
    documentNumber: input.documentNumber,
    version: input.versionNumber,
    contentHash: input.contentSha256,
    providerName: parties?.provider?.name ?? "Proveedor",
    customerName: parties?.customer?.name ?? "Cliente",
    sections: [
      ...sections,
      {
        title: "CONSTANCIA TECNICA",
        content: `Aceptaciones registradas: ${actions.length}. Sello interno: ${evidenceSeal.slice(0, 16)}. Este mecanismo no es firma electrónica avanzada ni certificación legal.`,
      },
    ],
  });
  const finalKey = `agreements/${input.agreementId}/${input.versionId}/executed.pdf`;
  const stored = await new LocalObjectStorage().put({
    tenantId: input.tenantId,
    key: finalKey,
    body: pdf,
    contentType: "application/pdf",
  });
  await tx.insert(agreementEvidenceBundles).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    agreementId: input.agreementId,
    versionId: input.versionId,
    envelopeId: input.envelopeId,
    status: "sealed",
    canonicalEvidence,
    evidenceSha256,
    keyVersion: Number(process.env.AGREEMENT_EVIDENCE_KEY_VERSION ?? "1"),
    evidenceSeal,
    finalPdfKey: stored.key,
    finalPdfSha256: stored.sha256,
    completedAt: new Date(),
  });
  await tx
    .update(agreementEnvelopes)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(agreementEnvelopes.tenantId, input.tenantId),
        eq(agreementEnvelopes.id, input.envelopeId),
      ),
    );
  await tx
    .update(agreements)
    .set({
      status: "executed",
      executedVersionId: input.versionId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(agreements.tenantId, input.tenantId),
        eq(agreements.id, input.agreementId),
      ),
    );
  await tx.insert(agreementOutboxEvents).values({
    id: crypto.randomUUID(),
    tenantId: input.tenantId,
    name: "AgreementExecuted.v1",
    aggregateId: input.agreementId,
    payload: {
      agreementId: input.agreementId,
      versionId: input.versionId,
      executionMethod: "internal_electronic_acceptance",
      contentSha256: input.contentSha256,
      evidenceSha256,
      finalPdfSha256: stored.sha256,
    },
  });
}
