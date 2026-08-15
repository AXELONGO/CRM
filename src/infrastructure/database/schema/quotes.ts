import { sql } from "drizzle-orm";
import {
  bigint,
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
import { tenantMemberships, tenants } from "./tenancy";

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "pending_internal_approval",
  "ready_to_issue",
  "issued",
  "viewed",
  "changes_requested",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
]);
export const quoteDiscountTypeEnum = pgEnum("quote_discount_type", [
  "none",
  "percent",
  "fixed",
]);
export const quoteDecisionEnum = pgEnum("quote_decision", [
  "accepted",
  "rejected",
  "changes_requested",
]);
export const quoteChallengeStatusEnum = pgEnum("quote_challenge_status", [
  "pending",
  "verified",
  "expired",
  "locked",
  "consumed",
]);
export const quoteRecordStatusEnum = pgEnum("quote_record_status", [
  "draft",
  "active",
  "archived",
]);

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const quoteNumberSequences = pgTable(
  "quote_number_sequences",
  {
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    prefix: text("prefix").default("COT").notNull(),
    nextValue: integer("next_value").default(1).notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId] }),
    check("quote_number_sequences_next_value_check", sql`${table.nextValue} > 0`),
  ],
);

export const quotes = pgTable(
  "quotes",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    number: text("number"),
    status: quoteStatusEnum("status").default("draft").notNull(),
    title: text("title").notNull(),
    currency: text("currency").notNull(),
    accountId: text("account_id"),
    contactId: text("contact_id"),
    opportunityId: text("opportunity_id"),
    expiresAt: instant("expires_at"),
    subtotalMinor: bigint("subtotal_minor", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    discountMinor: bigint("discount_minor", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    taxMinor: bigint("tax_minor", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    totalMinor: bigint("total_minor", { mode: "bigint" })
      .default(sql`0`)
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
    ownerMembershipId: text("owner_membership_id"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("quotes_number_unique").on(table.tenantId, table.number),
    index("quotes_tenant_status_idx").on(table.tenantId, table.status, table.updatedAt),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "quotes_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "quotes_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.ownerMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "quotes_owner_same_tenant_fk",
    }),
    check("quotes_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check("quotes_title_check", sql`char_length(${table.title}) between 2 and 200`),
    check(
      "quotes_amounts_check",
      sql`${table.totalMinor} >= 0 and ${table.subtotalMinor} >= 0`,
    ),
  ],
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    quoteId: text("quote_id").notNull(),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: text("quantity").notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
    discountType: quoteDiscountTypeEnum("discount_type").default("none").notNull(),
    discountValue: bigint("discount_value", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    taxRateBps: bigint("tax_rate_bps", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    subtotalMinor: bigint("subtotal_minor", { mode: "bigint" }).notNull(),
    discountMinor: bigint("discount_minor", { mode: "bigint" }).notNull(),
    taxMinor: bigint("tax_minor", { mode: "bigint" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.quoteId],
      foreignColumns: [quotes.tenantId, quotes.id],
      name: "quote_items_quote_same_tenant_fk",
    }),
    uniqueIndex("quote_items_position_unique").on(
      table.tenantId,
      table.quoteId,
      table.position,
    ),
    check("quote_items_position_check", sql`${table.position} > 0`),
    check(
      "quote_items_price_check",
      sql`${table.unitPriceMinor} >= 0 and ${table.totalMinor} >= 0`,
    ),
  ],
);

export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    quoteId: text("quote_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    pdfKey: text("pdf_key"),
    pdfSha256: text("pdf_sha256"),
    rendererVersion: text("renderer_version"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.quoteId],
      foreignColumns: [quotes.tenantId, quotes.id],
      name: "quote_versions_quote_same_tenant_fk",
    }),
    uniqueIndex("quote_versions_number_unique").on(
      table.tenantId,
      table.quoteId,
      table.versionNumber,
    ),
  ],
);

export const quotePublicLinks = pgTable(
  "quote_public_links",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    quoteId: text("quote_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    active: boolean("active").default(true).notNull(),
    expiresAt: instant("expires_at"),
    lastAccessedAt: instant("last_accessed_at"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.quoteId],
      foreignColumns: [quotes.tenantId, quotes.id],
      name: "quote_public_links_quote_same_tenant_fk",
    }),
    uniqueIndex("quote_public_links_token_hash_unique").on(table.tokenHash),
    index("quote_public_links_lookup_idx").on(table.tokenHash, table.active),
  ],
);

export const quotePublicSessions = pgTable(
  "quote_public_sessions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    quoteId: text("quote_id").notNull(),
    sessionHash: text("session_hash").notNull(),
    csrfHash: text("csrf_hash").notNull(),
    expiresAt: instant("expires_at").notNull(),
    revokedAt: instant("revoked_at"),
    otpLockedAt: instant("otp_locked_at"),
    otpLastSentAt: instant("otp_last_sent_at"),
    otpRequestWindowStartedAt: instant("otp_request_window_started_at"),
    otpRequestCount: integer("otp_request_count").default(0).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.quoteId],
      foreignColumns: [quotes.tenantId, quotes.id],
      name: "quote_public_sessions_quote_same_tenant_fk",
    }),
    uniqueIndex("quote_public_sessions_hash_unique").on(table.sessionHash),
  ],
);

export const quoteDrafts = pgTable(
  "quote_drafts",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    quoteId: text("quote_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    pricingModel: text("pricing_model").notNull(),
    currency: text("currency").notNull(),
    validityDays: integer("validity_days"),
    clientNotes: text("client_notes"),
    internalNotes: text("internal_notes"),
    optimisticVersion: integer("optimistic_version").default(1).notNull(),
    calculatedAt: instant("calculated_at"),
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
      columns: [table.tenantId, table.quoteId],
      foreignColumns: [quotes.tenantId, quotes.id],
      name: "quote_drafts_quote_same_tenant_fk",
    }),
    index("quote_drafts_quote_updated_idx").on(
      table.tenantId,
      table.quoteId,
      table.updatedAt,
    ),
  ],
);

export const quoteDraftItems = pgTable(
  "quote_draft_items",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    draftId: text("draft_id").notNull(),
    position: integer("position").notNull(),
    itemType: text("item_type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    quantity: text("quantity").notNull(),
    unit: text("unit").notNull(),
    unitPriceMinor: bigint("unit_price_minor", { mode: "bigint" }).notNull(),
    discountType: quoteDiscountTypeEnum("discount_type").default("none").notNull(),
    discountValue: bigint("discount_value", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    taxRateBps: bigint("tax_rate_bps", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    subtotalMinor: bigint("subtotal_minor", { mode: "bigint" }).notNull(),
    discountMinor: bigint("discount_minor", { mode: "bigint" }).notNull(),
    taxMinor: bigint("tax_minor", { mode: "bigint" }).notNull(),
    totalMinor: bigint("total_minor", { mode: "bigint" }).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.draftId],
      foreignColumns: [quoteDrafts.tenantId, quoteDrafts.id],
      name: "quote_draft_items_draft_same_tenant_fk",
    }),
    uniqueIndex("quote_draft_items_position_unique").on(
      table.tenantId,
      table.draftId,
      table.position,
    ),
  ],
);

export const quoteDraftSections = pgTable(
  "quote_draft_sections",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    draftId: text("draft_id").notNull(),
    sectionType: text("section_type").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    position: integer("position").notNull(),
    visible: boolean("visible").default(true).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.draftId],
      foreignColumns: [quoteDrafts.tenantId, quoteDrafts.id],
      name: "quote_draft_sections_draft_same_tenant_fk",
    }),
    uniqueIndex("quote_draft_sections_position_unique").on(
      table.tenantId,
      table.draftId,
      table.position,
    ),
  ],
);

export const commercialTaxRates = pgTable(
  "commercial_tax_rates",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull(),
    rateBps: bigint("rate_bps", { mode: "bigint" }).notNull(),
    status: quoteRecordStatusEnum("status").default("active").notNull(),
    position: integer("position").default(1).notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("commercial_tax_rates_label_unique").on(table.tenantId, table.label),
    check("commercial_tax_rates_bps_check", sql`${table.rateBps} between 0 and 10000`),
  ],
);

export const quoteClientDecisions = pgTable(
  "quote_client_decisions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    quoteId: text("quote_id").notNull(),
    quoteVersionId: text("quote_version_id").notNull(),
    decision: quoteDecisionEnum("decision").notNull(),
    declaredFullName: text("declared_full_name").notNull(),
    emailFingerprint: text("email_fingerprint").notNull(),
    challengeId: text("challenge_id").notNull(),
    sessionId: text("session_id").notNull(),
    contentHash: text("content_hash").notNull(),
    pdfHash: text("pdf_hash"),
    consentVersion: text("consent_version").notNull(),
    comment: text("comment"),
    idempotencyKey: text("idempotency_key").notNull(),
    occurredAt: instant("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.quoteId],
      foreignColumns: [quotes.tenantId, quotes.id],
      name: "quote_decisions_quote_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.quoteVersionId],
      foreignColumns: [quoteVersions.tenantId, quoteVersions.id],
      name: "quote_decisions_version_same_tenant_fk",
    }),
    uniqueIndex("quote_decisions_idempotency_unique").on(
      table.tenantId,
      table.quoteId,
      table.sessionId,
      table.idempotencyKey,
    ),
    uniqueIndex("quote_decisions_terminal_unique")
      .on(table.tenantId, table.quoteId)
      .where(sql`${table.decision} in ('accepted','rejected')`),
  ],
);

export const quoteEmailChallenges = pgTable(
  "quote_email_challenges",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    sessionId: text("session_id").notNull(),
    emailFingerprint: text("email_fingerprint").notNull(),
    codeHash: text("code_hash").notNull(),
    status: quoteChallengeStatusEnum("status").default("pending").notNull(),
    expiresAt: instant("expires_at").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    resendCount: integer("resend_count").default(0).notNull(),
    lastSentAt: instant("last_sent_at"),
    lockedAt: instant("locked_at"),
    verifiedAt: instant("verified_at"),
    consumedAt: instant("consumed_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.sessionId],
      foreignColumns: [quotePublicSessions.tenantId, quotePublicSessions.id],
      name: "quote_challenges_session_same_tenant_fk",
    }),
    index("quote_challenges_session_status_idx").on(
      table.tenantId,
      table.sessionId,
      table.status,
    ),
  ],
);

export const quoteOutboxEvents = pgTable(
  "quote_outbox_events",
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
    index("quote_outbox_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);
