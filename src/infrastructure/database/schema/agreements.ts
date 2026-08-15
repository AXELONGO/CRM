import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { commercialAccounts, commercialContacts } from "./commercial-directory";
import { quoteVersions, quotes } from "./quotes";
import { tenantMemberships, tenants } from "./tenancy";

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const agreementTypeEnum = pgEnum("agreement_type", [
  "fixed_project_service_agreement",
  "hourly_consulting_agreement",
  "retainer_service_agreement",
  "signable_proposal",
  "statement_of_work",
]);
export const agreementStatusEnum = pgEnum("agreement_status", [
  "draft",
  "pending_internal_review",
  "ready_to_issue",
  "issued",
  "partially_accepted",
  "signatures_complete",
  "executed",
  "changes_requested",
  "declined",
  "expired",
  "voided",
]);
export const agreementMethodEnum = pgEnum("agreement_method", [
  "internal_electronic_acceptance",
  "external_signed_pdf",
]);
export const envelopeStatusEnum = pgEnum("agreement_envelope_status", [
  "draft",
  "ready",
  "sent",
  "partially_completed",
  "signatures_complete",
  "completed",
  "declined",
  "changes_requested",
  "expired",
  "voided",
]);
export const signingOrderEnum = pgEnum("agreement_signing_order", [
  "provider_first",
  "customer_first",
  "parallel",
]);
export const recipientStatusEnum = pgEnum("agreement_recipient_status", [
  "pending",
  "available",
  "viewed",
  "accepted",
  "declined",
  "changes_requested",
  "expired",
]);
export const recipientTypeEnum = pgEnum("agreement_recipient_type", [
  "internal_member",
  "external_contact",
]);
export const agreementActionEnum = pgEnum("agreement_action", [
  "accepted",
  "declined",
  "changes_requested",
]);
export const evidenceStatusEnum = pgEnum("agreement_evidence_status", [
  "building",
  "sealed",
  "failed",
]);
export const externalReviewStatusEnum = pgEnum("agreement_external_review_status", [
  "pending",
  "verified",
  "rejected",
]);
export const agreementRecordStatusEnum = pgEnum("agreement_record_status", [
  "draft",
  "active",
  "archived",
]);
export const agreementReviewDecisionEnum = pgEnum("agreement_review_decision", [
  "approved",
  "rejected",
]);
export const agreementReviewAreaEnum = pgEnum("agreement_review_area", [
  "commercial",
  "legal_internal",
  "finance",
]);

export const agreementNumberSequences = pgTable(
  "agreement_number_sequences",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    year: integer("year").notNull(),
    prefix: text("prefix").default("CTR").notNull(),
    nextValue: integer("next_value").default(1).notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.year] }),
    check("agreement_number_sequences_value_check", sql`${table.nextValue} > 0`),
  ],
);

export const agreements = pgTable(
  "agreements",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    agreementType: agreementTypeEnum("agreement_type").notNull(),
    status: agreementStatusEnum("status").default("draft").notNull(),
    number: text("number"),
    title: text("title").notNull(),
    quoteId: text("quote_id").notNull(),
    quoteVersionId: text("quote_version_id").notNull(),
    opportunityId: text("opportunity_id"),
    accountId: text("account_id"),
    contactId: text("contact_id"),
    ownerMembershipId: text("owner_membership_id").notNull(),
    currentDraftId: text("current_draft_id"),
    currentVersionId: text("current_version_id"),
    activeEnvelopeId: text("active_envelope_id"),
    executionMethod: agreementMethodEnum("execution_method"),
    executedVersionId: text("executed_version_id"),
    effectiveDateRule: text("effective_date_rule")
      .default("on_full_execution")
      .notNull(),
    version: integer("version").default(1).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("agreements_number_unique").on(table.tenantId, table.number),
    uniqueIndex("agreements_executed_quote_unique")
      .on(table.tenantId, table.quoteId)
      .where(sql`${table.status} = 'executed'`),
    index("agreements_status_updated_idx").on(
      table.tenantId,
      table.status,
      table.updatedAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.quoteId],
      foreignColumns: [quotes.tenantId, quotes.id],
      name: "agreements_quote_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.quoteVersionId],
      foreignColumns: [quoteVersions.tenantId, quoteVersions.id],
      name: "agreements_quote_version_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "agreements_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "agreements_contact_same_tenant_fk",
    }),
    check("agreements_title_check", sql`char_length(${table.title}) between 2 and 200`),
  ],
);

export const agreementDrafts = pgTable(
  "agreement_drafts",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    agreementId: text("agreement_id").notNull(),
    title: text("title").notNull(),
    preamble: text("preamble"),
    documentType: agreementTypeEnum("document_type").notNull(),
    effectiveDateRule: text("effective_date_rule").notNull(),
    term: jsonb("term").$type<Record<string, unknown>>().notNull(),
    parties: jsonb("parties").$type<Record<string, unknown>>().notNull(),
    sections: jsonb("sections").$type<Array<Record<string, unknown>>>().notNull(),
    paymentSchedule: jsonb("payment_schedule")
      .$type<Array<Record<string, unknown>>>()
      .notNull(),
    internalNotes: text("internal_notes"),
    expectedVersion: integer("expected_version").default(1).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.agreementId],
      foreignColumns: [agreements.tenantId, agreements.id],
      name: "agreement_drafts_agreement_same_tenant_fk",
    }),
    index("agreement_drafts_agreement_idx").on(
      table.tenantId,
      table.agreementId,
      table.updatedAt,
    ),
  ],
);

export const agreementVersions = pgTable(
  "agreement_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    agreementId: text("agreement_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    documentNumber: text("document_number").notNull(),
    status: agreementStatusEnum("status").notNull(),
    sourceQuoteId: text("source_quote_id").notNull(),
    sourceQuoteVersionId: text("source_quote_version_id").notNull(),
    sourceQuoteHash: text("source_quote_hash").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    contentSha256: text("content_sha256").notNull(),
    contentPdfKey: text("content_pdf_key"),
    contentPdfSha256: text("content_pdf_sha256"),
    rendererVersion: text("renderer_version"),
    issuedAt: instant("issued_at"),
    expiresAt: instant("expires_at"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.agreementId],
      foreignColumns: [agreements.tenantId, agreements.id],
      name: "agreement_versions_agreement_same_tenant_fk",
    }),
    uniqueIndex("agreement_versions_number_unique").on(
      table.tenantId,
      table.agreementId,
      table.versionNumber,
    ),
    uniqueIndex("agreement_versions_identity_unique").on(
      table.tenantId,
      table.id,
      table.agreementId,
    ),
    index("agreement_versions_hash_idx").on(table.tenantId, table.contentSha256),
  ],
);

export const agreementEnvelopes = pgTable(
  "agreement_envelopes",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    agreementId: text("agreement_id").notNull(),
    versionId: text("version_id").notNull(),
    method: agreementMethodEnum("method").notNull(),
    signingOrder: signingOrderEnum("signing_order").notNull(),
    status: envelopeStatusEnum("status").default("ready").notNull(),
    expiresAt: instant("expires_at").notNull(),
    generation: integer("generation").default(1).notNull(),
    senderMembershipId: text("sender_membership_id").notNull(),
    completedAt: instant("completed_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.agreementId],
      foreignColumns: [agreements.tenantId, agreements.id],
      name: "agreement_envelopes_agreement_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.versionId],
      foreignColumns: [agreementVersions.tenantId, agreementVersions.id],
      name: "agreement_envelopes_version_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.versionId, table.agreementId],
      foreignColumns: [
        agreementVersions.tenantId,
        agreementVersions.id,
        agreementVersions.agreementId,
      ],
      name: "agreement_envelopes_version_agreement_identity_fk",
    }),
    uniqueIndex("agreement_envelopes_identity_unique").on(
      table.tenantId,
      table.id,
      table.agreementId,
      table.versionId,
    ),
    uniqueIndex("agreement_envelopes_active_version_unique")
      .on(table.tenantId, table.versionId)
      .where(
        sql`${table.status} not in ('completed', 'declined', 'expired', 'voided')`,
      ),
  ],
);

export const agreementRecipients = pgTable(
  "agreement_recipients",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    envelopeId: text("envelope_id").notNull(),
    partySide: text("party_side").notNull(),
    recipientType: recipientTypeEnum("recipient_type").notNull(),
    membershipId: text("membership_id"),
    contactId: text("contact_id"),
    nameSnapshot: text("name_snapshot").notNull(),
    emailSnapshot: text("email_snapshot").notNull(),
    roleSnapshot: text("role_snapshot").notNull(),
    signingOrder: integer("signing_order").notNull(),
    required: boolean("required").default(true).notNull(),
    status: recipientStatusEnum("status").default("pending").notNull(),
    availableAt: instant("available_at"),
    viewedAt: instant("viewed_at"),
    actedAt: instant("acted_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.envelopeId],
      foreignColumns: [agreementEnvelopes.tenantId, agreementEnvelopes.id],
      name: "agreement_recipients_envelope_same_tenant_fk",
    }),
    uniqueIndex("agreement_recipients_party_unique").on(
      table.tenantId,
      table.envelopeId,
      table.partySide,
    ),
    uniqueIndex("agreement_recipients_envelope_identity_unique").on(
      table.tenantId,
      table.id,
      table.envelopeId,
    ),
    check(
      "agreement_recipients_order_check",
      sql`${table.signingOrder} between 1 and 2`,
    ),
  ],
);

export const agreementRecipientLinks = pgTable(
  "agreement_recipient_links",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: instant("expires_at").notNull(),
    active: boolean("active").default(true).notNull(),
    generation: integer("generation").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    revokedAt: instant("revoked_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.recipientId],
      foreignColumns: [agreementRecipients.tenantId, agreementRecipients.id],
      name: "agreement_recipient_links_recipient_same_tenant_fk",
    }),
    uniqueIndex("agreement_recipient_links_token_unique").on(table.tokenHash),
    uniqueIndex("agreement_recipient_links_active_unique")
      .on(table.tenantId, table.recipientId, table.generation)
      .where(sql`${table.active} = true`),
  ],
);

export const agreementPublicSessions = pgTable(
  "agreement_public_sessions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    sessionHash: text("session_hash").notNull(),
    csrfHash: text("csrf_hash").notNull(),
    expiresAt: instant("expires_at").notNull(),
    verifiedAt: instant("verified_at"),
    otpHash: text("otp_hash"),
    otpExpiresAt: instant("otp_expires_at"),
    otpAttempts: integer("otp_attempts").default(0).notNull(),
    otpUsedAt: instant("otp_used_at"),
    otpLockedAt: instant("otp_locked_at"),
    otpLastSentAt: instant("otp_last_sent_at"),
    otpResendCount: integer("otp_resend_count").default(0).notNull(),
    otpRequestWindowStartedAt: instant("otp_request_window_started_at"),
    otpRequestCount: integer("otp_request_count").default(0).notNull(),
    lastSeenAt: instant("last_seen_at").defaultNow().notNull(),
    revokedAt: instant("revoked_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.recipientId],
      foreignColumns: [agreementRecipients.tenantId, agreementRecipients.id],
      name: "agreement_public_sessions_recipient_same_tenant_fk",
    }),
    uniqueIndex("agreement_public_sessions_recipient_identity_unique").on(
      table.tenantId,
      table.id,
      table.recipientId,
    ),
    uniqueIndex("agreement_public_sessions_hash_unique").on(table.sessionHash),
  ],
);

export const agreementAcceptanceActions = pgTable(
  "agreement_acceptance_actions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    agreementId: text("agreement_id").notNull(),
    versionId: text("version_id").notNull(),
    envelopeId: text("envelope_id").notNull(),
    recipientId: text("recipient_id").notNull(),
    action: agreementActionEnum("action").notNull(),
    actorKind: recipientTypeEnum("actor_kind").notNull(),
    declaredFullName: text("declared_full_name").notNull(),
    declaredAuthority: boolean("declared_authority").default(false).notNull(),
    consentVersion: text("consent_version").notNull(),
    consentHash: text("consent_hash").notNull(),
    contentSha256: text("content_sha256").notNull(),
    contentPdfSha256: text("content_pdf_sha256"),
    emailFingerprint: text("email_fingerprint").notNull(),
    comment: text("comment"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    publicSessionId: text("public_session_id"),
    actorUserId: text("actor_user_id"),
    occurredAt: instant("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.agreementId],
      foreignColumns: [agreements.tenantId, agreements.id],
      name: "agreement_actions_agreement_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.versionId],
      foreignColumns: [agreementVersions.tenantId, agreementVersions.id],
      name: "agreement_actions_version_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.envelopeId],
      foreignColumns: [agreementEnvelopes.tenantId, agreementEnvelopes.id],
      name: "agreement_actions_envelope_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.recipientId],
      foreignColumns: [agreementRecipients.tenantId, agreementRecipients.id],
      name: "agreement_actions_recipient_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.envelopeId, table.agreementId, table.versionId],
      foreignColumns: [
        agreementEnvelopes.tenantId,
        agreementEnvelopes.id,
        agreementEnvelopes.agreementId,
        agreementEnvelopes.versionId,
      ],
      name: "agreement_actions_envelope_identity_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.recipientId, table.envelopeId],
      foreignColumns: [
        agreementRecipients.tenantId,
        agreementRecipients.id,
        agreementRecipients.envelopeId,
      ],
      name: "agreement_actions_recipient_envelope_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.publicSessionId, table.recipientId],
      foreignColumns: [
        agreementPublicSessions.tenantId,
        agreementPublicSessions.id,
        agreementPublicSessions.recipientId,
      ],
      name: "agreement_actions_public_session_recipient_fk",
    }),
    foreignKey({
      columns: [table.actorUserId],
      foreignColumns: [user.id],
      name: "agreement_actions_actor_user_fk",
    }),
    uniqueIndex("agreement_actions_idempotency_unique").on(
      table.tenantId,
      table.envelopeId,
      table.recipientId,
      table.idempotencyKey,
    ),
    uniqueIndex("agreement_actions_recipient_terminal_unique")
      .on(table.tenantId, table.recipientId)
      .where(sql`${table.action} in ('accepted', 'declined', 'changes_requested')`),
    check(
      "agreement_actions_actor_binding_check",
      sql`(
        (${table.actorKind} = 'external_contact' and ${table.publicSessionId} is not null and ${table.actorUserId} is null)
        or
        (${table.actorKind} = 'internal_member' and ${table.publicSessionId} is null and ${table.actorUserId} is not null)
      )`,
    ),
  ],
);

export const agreementEvidenceBundles = pgTable(
  "agreement_evidence_bundles",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    agreementId: text("agreement_id").notNull(),
    versionId: text("version_id").notNull(),
    envelopeId: text("envelope_id").notNull(),
    status: evidenceStatusEnum("status").default("building").notNull(),
    canonicalEvidence: jsonb("canonical_evidence")
      .$type<Record<string, unknown>>()
      .notNull(),
    evidenceSha256: text("evidence_sha256").notNull(),
    hmacAlgorithm: text("hmac_algorithm").default("HMAC-SHA-256").notNull(),
    keyVersion: integer("key_version").notNull(),
    evidenceSeal: text("evidence_seal").notNull(),
    finalPdfKey: text("final_pdf_key"),
    finalPdfSha256: text("final_pdf_sha256"),
    completedAt: instant("completed_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.agreementId],
      foreignColumns: [agreements.tenantId, agreements.id],
      name: "agreement_evidence_agreement_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.versionId],
      foreignColumns: [agreementVersions.tenantId, agreementVersions.id],
      name: "agreement_evidence_version_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.envelopeId],
      foreignColumns: [agreementEnvelopes.tenantId, agreementEnvelopes.id],
      name: "agreement_evidence_envelope_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.envelopeId, table.agreementId, table.versionId],
      foreignColumns: [
        agreementEnvelopes.tenantId,
        agreementEnvelopes.id,
        agreementEnvelopes.agreementId,
        agreementEnvelopes.versionId,
      ],
      name: "agreement_evidence_envelope_identity_fk",
    }),
    uniqueIndex("agreement_evidence_version_unique").on(
      table.tenantId,
      table.versionId,
    ),
  ],
);

export const agreementExternalExecutionRecords = pgTable(
  "agreement_external_execution_records",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    agreementId: text("agreement_id").notNull(),
    versionId: text("version_id").notNull(),
    storageKey: text("storage_key").notNull(),
    fileSha256: text("file_sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    mimeType: text("mime_type").notNull(),
    reviewStatus: externalReviewStatusEnum("review_status")
      .default("pending")
      .notNull(),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    reviewerComment: text("reviewer_comment"),
    declaredSignedAt: instant("declared_signed_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    reviewedAt: instant("reviewed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.agreementId],
      foreignColumns: [agreements.tenantId, agreements.id],
      name: "agreement_external_agreement_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.versionId],
      foreignColumns: [agreementVersions.tenantId, agreementVersions.id],
      name: "agreement_external_version_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.versionId, table.agreementId],
      foreignColumns: [
        agreementVersions.tenantId,
        agreementVersions.id,
        agreementVersions.agreementId,
      ],
      name: "agreement_external_version_agreement_identity_fk",
    }),
    check(
      "agreement_external_pdf_check",
      sql`${table.mimeType} = 'application/pdf' and ${table.sizeBytes} between 1 and 15728640`,
    ),
  ],
);

export const agreementOutboxEvents = pgTable(
  "agreement_outbox_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("agreement_outbox_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export const agreementClauseBlocks = pgTable(
  "agreement_clause_blocks",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    compatibleTypes: jsonb("compatible_types").$type<string[]>().notNull(),
    status: agreementRecordStatusEnum("status").default("draft").notNull(),
    activeVersionId: text("active_version_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("agreement_clause_blocks_name_unique").on(table.tenantId, table.name),
  ],
);

export const agreementClauseVersions = pgTable(
  "agreement_clause_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    clauseBlockId: text("clause_block_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    contentMarkdown: text("content_markdown").notNull(),
    legalReviewStatus: text("legal_review_status").default("unreviewed").notNull(),
    contentHash: text("content_hash").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.clauseBlockId],
      foreignColumns: [agreementClauseBlocks.tenantId, agreementClauseBlocks.id],
      name: "agreement_clause_versions_block_same_tenant_fk",
    }),
    uniqueIndex("agreement_clause_versions_number_unique").on(
      table.tenantId,
      table.clauseBlockId,
      table.versionNumber,
    ),
  ],
);

export const agreementTemplates = pgTable(
  "agreement_templates",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    documentType: agreementTypeEnum("document_type").notNull(),
    pricingModel: text("pricing_model").notNull(),
    status: agreementRecordStatusEnum("status").default("draft").notNull(),
    activeVersionId: text("active_version_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("agreement_templates_name_unique").on(table.tenantId, table.name),
  ],
);

export const agreementTemplateVersions = pgTable(
  "agreement_template_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    templateId: text("template_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    sections: jsonb("sections").$type<Array<Record<string, unknown>>>().notNull(),
    variables: jsonb("variables").$type<string[]>().notNull(),
    consentText: text("consent_text").notNull(),
    contentHash: text("content_hash").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.templateId],
      foreignColumns: [agreementTemplates.tenantId, agreementTemplates.id],
      name: "agreement_template_versions_template_same_tenant_fk",
    }),
    uniqueIndex("agreement_template_versions_number_unique").on(
      table.tenantId,
      table.templateId,
      table.versionNumber,
    ),
  ],
);

export const agreementReviewPolicies = pgTable("agreement_review_policies", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "restrict" }),
  mode: text("mode").default("disabled").notNull(),
  separationOfDuties: boolean("separation_of_duties").default(true).notNull(),
  financeReviewPaymentSchedule: boolean("finance_review_payment_schedule")
    .default(false)
    .notNull(),
  updatedByUserId: text("updated_by_user_id")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  updatedAt: instant("updated_at").defaultNow().notNull(),
});

export const agreementInternalReviews = pgTable(
  "agreement_internal_reviews",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    agreementId: text("agreement_id").notNull(),
    versionCandidate: integer("version_candidate").notNull(),
    area: agreementReviewAreaEnum("area").notNull(),
    decision: agreementReviewDecisionEnum("decision").notNull(),
    comment: text("comment"),
    reviewerUserId: text("reviewer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.agreementId],
      foreignColumns: [agreements.tenantId, agreements.id],
      name: "agreement_reviews_agreement_same_tenant_fk",
    }),
    uniqueIndex("agreement_reviews_area_candidate_unique").on(
      table.tenantId,
      table.agreementId,
      table.versionCandidate,
      table.area,
    ),
    check(
      "agreement_reviews_rejection_comment_check",
      sql`${table.decision} = 'approved' or char_length(coalesce(${table.comment}, '')) >= 5`,
    ),
  ],
);
