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

const instant = (name: string) => timestamp(name, { withTimezone: true });
export const paymentSourceKindEnum = pgEnum("payment_source_kind", [
  "accepted_quote_version",
  "executed_agreement_version",
]);
export const paymentModelEnum = pgEnum("payment_commercial_model", [
  "fixed",
  "hourly",
  "retainer",
  "other",
]);
export const receivablePlanStatusEnum = pgEnum("receivable_plan_status", [
  "draft",
  "open",
  "partially_paid",
  "completed",
  "cancelled",
  "exception",
]);
export const installmentKindEnum = pgEnum("receivable_installment_kind", [
  "deposit",
  "milestone",
  "hourly_period",
  "retainer_period",
  "final",
  "other",
]);
export const installmentStatusEnum = pgEnum("receivable_installment_status", [
  "scheduled",
  "open",
  "partially_paid",
  "paid",
  "past_due",
  "cancelled",
  "exception",
]);
export const depositPolicyEnum = pgEnum("deposit_policy", [
  "none",
  "exact_amount",
  "percentage",
  "first_installment",
]);
export const depositStatusEnum = pgEnum("deposit_status", [
  "not_required",
  "pending",
  "satisfied",
  "reversed",
  "exception",
]);
export const paymentProviderEnum = pgEnum("payment_provider", [
  "stripe",
  "mercadopago",
  "paypal",
  "manual",
  "fake",
]);
export const paymentEnvironmentEnum = pgEnum("payment_environment", [
  "sandbox",
  "live",
]);
export const paymentConnectionStatusEnum = pgEnum("payment_connection_status", [
  "draft",
  "authorization_pending",
  "verifying",
  "active",
  "degraded",
  "blocked",
  "revoked",
  "disconnected",
]);
export const paymentRequestStatusEnum = pgEnum("payment_request_status", [
  "draft",
  "creating",
  "open",
  "processing",
  "paid",
  "expired",
  "cancelled",
  "failed",
  "exception",
  "reversed",
]);
export const paymentAttemptStatusEnum = pgEnum("payment_attempt_status", [
  "created",
  "pending",
  "succeeded",
  "failed",
  "cancelled",
  "reversed",
  "exception",
]);
export const paymentRecordStatusEnum = pgEnum("payment_record_status", [
  "pending_review",
  "confirmed",
  "reversed",
  "rejected",
  "exception",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "manual_transfer",
  "cash",
  "check",
  "fake_checkout",
  "provider",
]);
export const paymentEventKindEnum = pgEnum("payment_event_kind", [
  "payment_confirmed",
  "refund_observed",
  "chargeback_observed",
  "reversal_observed",
]);
export const paymentExceptionTypeEnum = pgEnum("payment_exception_type", [
  "amount_mismatch",
  "currency_mismatch",
  "overpayment",
  "manual_duplicate_suspected",
  "refund_or_chargeback",
  "stale_processing",
]);
export const paymentExceptionStatusEnum = pgEnum("payment_exception_status", [
  "open",
  "investigating",
  "resolved",
  "ignored",
]);
export const manualPaymentStatusEnum = pgEnum("manual_payment_status", [
  "pending_review",
  "approved",
  "rejected",
  "voided",
]);
export const paymentAdjustmentKindEnum = pgEnum("payment_adjustment_kind", [
  "partial_refund",
  "full_refund",
  "chargeback",
  "reversal",
  "correction",
]);
export const mercadoPagoConnectionStatusEnum = pgEnum(
  "mercado_pago_connection_status",
  [
    "draft",
    "authorization_pending",
    "connected",
    "degraded",
    "reauthorization_required",
    "disconnected",
  ],
);
export const oauthAttemptResultEnum = pgEnum("oauth_attempt_result", [
  "pending",
  "succeeded",
  "cancelled",
  "failed",
  "expired",
]);
export const stripeConnectionStatusEnum = pgEnum("stripe_connection_status", [
  "draft",
  "authorization_pending",
  "connected",
  "restricted",
  "payments_disabled",
  "payouts_disabled",
  "deauthorized",
  "disconnected",
]);
export const paypalConnectionStatusEnum = pgEnum("paypal_connection_status", [
  "draft",
  "onboarding_pending",
  "onboarding_returned",
  "connected",
  "restricted",
  "disconnected",
  "revoked",
]);

export const receivablePlans = pgTable(
  "receivable_plans",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    customerAccountId: text("customer_account_id"),
    billingContactId: text("billing_contact_id"),
    sourceKind: paymentSourceKindEnum("source_kind").notNull(),
    sourceId: text("source_id").notNull(),
    sourceVersionId: text("source_version_id").notNull(),
    sourceHash: text("source_hash").notNull(),
    sourceNumber: text("source_number"),
    commercialModel: paymentModelEnum("commercial_model").notNull(),
    currency: text("currency").notNull(),
    expectedTotalMinor: bigint("expected_total_minor", { mode: "bigint" }).notNull(),
    scheduledTotalMinor: bigint("scheduled_total_minor", { mode: "bigint" }).notNull(),
    status: receivablePlanStatusEnum("status").default("draft").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    version: integer("version").default(1).notNull(),
    openedAt: instant("opened_at"),
    cancelledAt: instant("cancelled_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("receivable_plans_source_version_unique").on(
      table.tenantId,
      table.sourceKind,
      table.sourceVersionId,
    ),
    foreignKey({
      columns: [table.tenantId, table.customerAccountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "receivable_plans_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.billingContactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "receivable_plans_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.createdByMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "receivable_plans_membership_same_tenant_fk",
    }),
    check("receivable_plans_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "receivable_plans_amount_check",
      sql`${table.expectedTotalMinor} >= 0 and ${table.scheduledTotalMinor} >= 0`,
    ),
  ],
);

export const receivableInstallments = pgTable(
  "receivable_installments",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    planId: text("plan_id").notNull(),
    sequence: integer("sequence").notNull(),
    label: text("label").notNull(),
    dueDate: text("due_date").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    kind: installmentKindEnum("kind").notNull(),
    expectedPercentage: integer("expected_percentage"),
    status: installmentStatusEnum("status").default("scheduled").notNull(),
    paidAmountMinor: bigint("paid_amount_minor", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    paidAt: instant("paid_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("receivable_installments_sequence_unique").on(
      table.tenantId,
      table.planId,
      table.sequence,
    ),
    foreignKey({
      columns: [table.tenantId, table.planId],
      foreignColumns: [receivablePlans.tenantId, receivablePlans.id],
      name: "receivable_installments_plan_same_tenant_fk",
    }),
    check(
      "receivable_installments_amount_check",
      sql`${table.amountMinor} > 0 and ${table.paidAmountMinor} >= 0`,
    ),
    check(
      "receivable_installments_currency_check",
      sql`${table.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export const depositRequirements = pgTable(
  "deposit_requirements",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    planId: text("plan_id").notNull(),
    policy: depositPolicyEnum("policy").notNull(),
    requiredAmountMinor: bigint("required_amount_minor", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    currency: text("currency").notNull(),
    percentage: integer("percentage"),
    qualifyingInstallmentIds: jsonb("qualifying_installment_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    status: depositStatusEnum("status").default("pending").notNull(),
    satisfiedAmountMinor: bigint("satisfied_amount_minor", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    satisfiedAt: instant("satisfied_at"),
    reversedAt: instant("reversed_at"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("deposit_requirements_plan_unique").on(table.tenantId, table.planId),
    foreignKey({
      columns: [table.tenantId, table.planId],
      foreignColumns: [receivablePlans.tenantId, receivablePlans.id],
      name: "deposit_requirements_plan_same_tenant_fk",
    }),
    check(
      "deposit_requirements_percentage_check",
      sql`${table.percentage} is null or ${table.percentage} between 1 and 100`,
    ),
  ],
);

export const paymentConnections = pgTable(
  "payment_connections",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    provider: paymentProviderEnum("provider").notNull(),
    environment: paymentEnvironmentEnum("environment").notNull(),
    displayName: text("display_name").notNull(),
    externalAccountId: text("external_account_id"),
    externalAccountDisplay: text("external_account_display"),
    capabilities: jsonb("capabilities")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    status: paymentConnectionStatusEnum("status").default("draft").notNull(),
    secretReference: text("secret_reference"),
    connectedByMembershipId: text("connected_by_membership_id"),
    lastVerifiedAt: instant("last_verified_at"),
    lastErrorCode: text("last_error_code"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("payment_connections_provider_environment_unique").on(
      table.tenantId,
      table.provider,
      table.environment,
    ),
  ],
);

export const mercadoPagoProfiles = pgTable(
  "mercado_pago_profiles",
  {
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    environment: text("environment").notNull(),
    sellerUserId: text("seller_user_id"),
    countryCode: text("country_code"),
    siteId: text("site_id"),
    nicknameMasked: text("nickname_masked"),
    emailMasked: text("email_masked"),
    scopes: jsonb("scopes").$type<string[]>().default([]).notNull(),
    status: mercadoPagoConnectionStatusEnum("status").default("draft").notNull(),
    accessTokenSecretRef: text("access_token_secret_ref"),
    refreshTokenSecretRef: text("refresh_token_secret_ref"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    tokenVersion: integer("token_version").default(1).notNull(),
    lastHealthCheckAt: instant("last_health_check_at"),
    lastWebhookAt: instant("last_webhook_at"),
    lastReconciledAt: instant("last_reconciled_at"),
    authorizedAt: instant("authorized_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.connectionId] }),
    uniqueIndex("mercado_pago_seller_active_unique")
      .on(table.environment, table.sellerUserId)
      .where(
        sql`${table.status} in ('connected', 'degraded', 'reauthorization_required')`,
      ),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [paymentConnections.tenantId, paymentConnections.id],
      name: "mercado_pago_profile_connection_same_tenant_fk",
    }),
  ],
);

export const stripeProfiles = pgTable(
  "stripe_profiles",
  {
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    environment: text("environment").notNull(),
    stripeAccountId: text("stripe_account_id"),
    oauthScope: text("oauth_scope"),
    country: text("country"),
    defaultCurrency: text("default_currency"),
    businessNameMasked: text("business_name_masked"),
    detailsSubmitted: boolean("details_submitted"),
    chargesEnabled: boolean("charges_enabled"),
    payoutsEnabled: boolean("payouts_enabled"),
    cardPaymentsCapability: text("card_payments_capability"),
    requirementsSummary: jsonb("requirements_summary")
      .$type<string[]>()
      .default([])
      .notNull(),
    status: stripeConnectionStatusEnum("status").default("draft").notNull(),
    connectedAt: instant("connected_at"),
    lastAccountSyncAt: instant("last_account_sync_at"),
    lastWebhookAt: instant("last_webhook_at"),
    lastReconciledAt: instant("last_reconciled_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.connectionId] }),
    uniqueIndex("stripe_account_global_unique").on(table.stripeAccountId),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [paymentConnections.tenantId, paymentConnections.id],
      name: "stripe_profile_connection_same_tenant_fk",
    }),
  ],
);

export const paypalProfiles = pgTable(
  "paypal_profiles",
  {
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    environment: text("environment").notNull(),
    merchantId: text("merchant_id"),
    emailMasked: text("email_masked"),
    countryCode: text("country_code"),
    product: text("product"),
    paymentsReceivable: boolean("payments_receivable"),
    consentStatus: text("consent_status"),
    capabilities: jsonb("capabilities").$type<string[]>().default([]).notNull(),
    status: paypalConnectionStatusEnum("status").default("draft").notNull(),
    onboardingActionRef: text("onboarding_action_ref"),
    lastHealthCheckAt: instant("last_health_check_at"),
    lastWebhookAt: instant("last_webhook_at"),
    lastReconciledAt: instant("last_reconciled_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.connectionId] }),
    uniqueIndex("paypal_merchant_global_unique").on(table.merchantId),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [paymentConnections.tenantId, paymentConnections.id],
      name: "paypal_profile_connection_same_tenant_fk",
    }),
  ],
);

export const paymentSecretValues = pgTable(
  "payment_secret_values",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    logicalName: text("logical_name").notNull(),
    ciphertext: text("ciphertext").notNull(),
    nonce: text("nonce").notNull(),
    authenticationTag: text("authentication_tag").notNull(),
    keyVersion: integer("key_version").notNull(),
    algorithm: text("algorithm").notNull(),
    fingerprint: text("fingerprint").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("payment_secrets_connection_name_unique").on(
      table.tenantId,
      table.connectionId,
      table.logicalName,
    ),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [paymentConnections.tenantId, paymentConnections.id],
      name: "payment_secrets_connection_same_tenant_fk",
    }),
  ],
);

export const oauthAuthorizationAttempts = pgTable(
  "oauth_authorization_attempts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    provider: text("provider").notNull(),
    connectionId: text("connection_id").notNull(),
    initiatedByUserId: text("initiated_by_user_id").notNull(),
    stateHash: text("state_hash").notNull().unique(),
    codeVerifierCiphertext: text("code_verifier_ciphertext"),
    codeVerifierNonce: text("code_verifier_nonce"),
    codeVerifierTag: text("code_verifier_tag"),
    codeVerifierKeyVersion: integer("code_verifier_key_version"),
    redirectUriVersion: text("redirect_uri_version").notNull(),
    requestedScopes: jsonb("requested_scopes").$type<string[]>().default([]).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    expiresAt: instant("expires_at").notNull(),
    consumedAt: instant("consumed_at"),
    result: oauthAttemptResultEnum("result").default("pending").notNull(),
  },
  (table) => [
    index("oauth_attempts_tenant_expiry_idx").on(table.tenantId, table.expiresAt),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [paymentConnections.tenantId, paymentConnections.id],
      name: "oauth_attempt_connection_same_tenant_fk",
    }),
  ],
);

export const paymentRequests = pgTable(
  "payment_requests",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    planId: text("plan_id").notNull(),
    installmentId: text("installment_id").notNull(),
    connectionId: text("connection_id").notNull(),
    publicTokenHash: text("public_token_hash").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    descriptionSnapshot: text("description_snapshot").notNull(),
    externalReference: text("external_reference").notNull(),
    status: paymentRequestStatusEnum("status").default("draft").notNull(),
    checkoutExternalId: text("checkout_external_id"),
    hostedUrl: text("hosted_url"),
    expiresAt: instant("expires_at").notNull(),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    fulfilledAt: instant("fulfilled_at"),
    cancelledAt: instant("cancelled_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("payment_requests_token_unique").on(table.publicTokenHash),
    uniqueIndex("payment_requests_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    uniqueIndex("payment_requests_external_reference_unique").on(
      table.tenantId,
      table.externalReference,
    ),
    foreignKey({
      columns: [table.tenantId, table.planId],
      foreignColumns: [receivablePlans.tenantId, receivablePlans.id],
      name: "payment_requests_plan_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.installmentId],
      foreignColumns: [receivableInstallments.tenantId, receivableInstallments.id],
      name: "payment_requests_installment_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [paymentConnections.tenantId, paymentConnections.id],
      name: "payment_requests_connection_same_tenant_fk",
    }),
    check("payment_requests_amount_check", sql`${table.amountMinor} > 0`),
  ],
);

export const paymentRecords = pgTable(
  "payment_records",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    planId: text("plan_id").notNull(),
    requestId: text("request_id"),
    provider: paymentProviderEnum("provider").notNull(),
    method: paymentMethodEnum("method").notNull(),
    externalPaymentId: text("external_payment_id"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    status: paymentRecordStatusEnum("status").default("pending_review").notNull(),
    evidenceKey: text("evidence_key"),
    referenceMasked: text("reference_masked"),
    note: text("note"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: instant("created_at").defaultNow().notNull(),
    confirmedAt: instant("confirmed_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("payment_records_provider_external_unique").on(
      table.tenantId,
      table.provider,
      table.externalPaymentId,
    ),
    foreignKey({
      columns: [table.tenantId, table.planId],
      foreignColumns: [receivablePlans.tenantId, receivablePlans.id],
      name: "payment_records_plan_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.requestId],
      foreignColumns: [paymentRequests.tenantId, paymentRequests.id],
      name: "payment_records_request_same_tenant_fk",
    }),
    check("payment_records_amount_check", sql`${table.amountMinor} > 0`),
  ],
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    paymentId: text("payment_id").notNull(),
    installmentId: text("installment_id").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.paymentId],
      foreignColumns: [paymentRecords.tenantId, paymentRecords.id],
      name: "payment_allocations_payment_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.installmentId],
      foreignColumns: [receivableInstallments.tenantId, receivableInstallments.id],
      name: "payment_allocations_installment_same_tenant_fk",
    }),
    check("payment_allocations_amount_check", sql`${table.amountMinor} > 0`),
  ],
);

export const paymentOutboxEvents = pgTable(
  "payment_outbox_events",
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
    index("payment_outbox_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export const paymentProviderEvents = pgTable(
  "payment_provider_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    eventKey: text("event_key").notNull(),
    kind: paymentEventKindEnum("kind").notNull(),
    digest: text("digest").notNull(),
    processedAt: instant("processed_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payment_provider_events_connection_key_unique").on(
      table.connectionId,
      table.eventKey,
    ),
  ],
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    requestId: text("request_id").notNull(),
    connectionId: text("connection_id").notNull(),
    externalCheckoutId: text("external_checkout_id"),
    externalPaymentId: text("external_payment_id"),
    status: paymentAttemptStatusEnum("status").default("created").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("payment_attempts_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.tenantId, table.requestId],
      foreignColumns: [paymentRequests.tenantId, paymentRequests.id],
      name: "payment_attempts_request_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [paymentConnections.tenantId, paymentConnections.id],
      name: "payment_attempts_connection_same_tenant_fk",
    }),
    check("payment_attempts_amount_check", sql`${table.amountMinor} > 0`),
  ],
);

export const manualPaymentSubmissions = pgTable(
  "manual_payment_submissions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    planId: text("plan_id").notNull(),
    installmentId: text("installment_id"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    paidAt: instant("paid_at").notNull(),
    method: paymentMethodEnum("method").notNull(),
    referenceMasked: text("reference_masked"),
    institution: text("institution"),
    note: text("note"),
    evidenceKey: text("evidence_key"),
    status: manualPaymentStatusEnum("status").default("pending_review").notNull(),
    submittedByMembershipId: text("submitted_by_membership_id").notNull(),
    reviewedByMembershipId: text("reviewed_by_membership_id"),
    decisionReason: text("decision_reason"),
    idempotencyKey: text("idempotency_key").notNull(),
    submittedAt: instant("submitted_at").defaultNow().notNull(),
    reviewedAt: instant("reviewed_at"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("manual_payment_submissions_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.tenantId, table.planId],
      foreignColumns: [receivablePlans.tenantId, receivablePlans.id],
      name: "manual_payment_submissions_plan_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.installmentId],
      foreignColumns: [receivableInstallments.tenantId, receivableInstallments.id],
      name: "manual_payment_submissions_installment_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.submittedByMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "manual_payment_submissions_submitter_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.reviewedByMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "manual_payment_submissions_reviewer_same_tenant_fk",
    }),
    check("manual_payment_submissions_amount_check", sql`${table.amountMinor} > 0`),
  ],
);

export const paymentAdjustments = pgTable(
  "payment_adjustments",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    paymentId: text("payment_id").notNull(),
    kind: paymentAdjustmentKindEnum("kind").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    externalAdjustmentId: text("external_adjustment_id"),
    reason: text("reason").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("payment_adjustments_external_unique").on(
      table.tenantId,
      table.externalAdjustmentId,
    ),
    foreignKey({
      columns: [table.tenantId, table.paymentId],
      foreignColumns: [paymentRecords.tenantId, paymentRecords.id],
      name: "payment_adjustments_payment_same_tenant_fk",
    }),
    check("payment_adjustments_amount_check", sql`${table.amountMinor} > 0`),
  ],
);

export const paymentExceptions = pgTable(
  "payment_exceptions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    type: paymentExceptionTypeEnum("type").notNull(),
    status: paymentExceptionStatusEnum("status").default("open").notNull(),
    paymentId: text("payment_id"),
    requestId: text("request_id"),
    expectedSnapshot: jsonb("expected_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    observedSnapshot: jsonb("observed_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    resolutionNote: text("resolution_note"),
    createdAt: instant("created_at").defaultNow().notNull(),
    resolvedAt: instant("resolved_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.paymentId],
      foreignColumns: [paymentRecords.tenantId, paymentRecords.id],
      name: "payment_exceptions_payment_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.requestId],
      foreignColumns: [paymentRequests.tenantId, paymentRequests.id],
      name: "payment_exceptions_request_same_tenant_fk",
    }),
    index("payment_exceptions_open_idx").on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
  ],
);
