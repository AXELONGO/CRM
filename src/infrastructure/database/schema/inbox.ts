import { relations, sql } from "drizzle-orm";
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
import { commercialAccounts, commercialContacts } from "./commercial-directory";
import { salesLeadSources, salesOpportunities } from "./sales";
import { tenantMemberships, tenants } from "./tenancy";
import { user } from "./auth";

export const inboxChannelEnum = pgEnum("inbox_channel", [
  "whatsapp_meta",
  "whatsapp_waha",
  "web_form",
  "email",
  "meta_lead_ads",
  "messenger",
  "instagram",
]);
export const inboxConnectionStatusEnum = pgEnum("inbox_connection_status", [
  "draft",
  "configured",
  "verifying",
  "active",
  "degraded",
  "disabled",
  "blocked",
]);
export const inboxConversationStatusEnum = pgEnum("inbox_conversation_status", [
  "open",
  "pending",
  "closed",
  "spam",
]);
export const inboxPriorityEnum = pgEnum("inbox_priority", ["normal", "high"]);
export const inboxDirectionEnum = pgEnum("inbox_direction", ["inbound", "outbound"]);
export const inboxMessageKindEnum = pgEnum("inbox_message_kind", [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "location",
  "contact_card",
  "form_submission",
  "unsupported",
]);
export const inboxMessageStatusEnum = pgEnum("inbox_message_status", [
  "received",
  "queued",
  "sending",
  "sent",
  "delivered",
  "read",
  "failed",
  "cancelled",
]);
export const inboxReceiptStatusEnum = pgEnum("inbox_receipt_status", [
  "received",
  "queued",
  "processed",
  "rejected",
  "dead",
]);
export const inboxJobStatusEnum = pgEnum("inbox_job_status", [
  "pending",
  "processing",
  "succeeded",
  "retry",
  "dead",
]);
export const inboxIdentityStatusEnum = pgEnum("inbox_identity_status", [
  "unresolved",
  "linked",
  "ambiguous",
]);
export const inboxFormStatusEnum = pgEnum("inbox_form_status", [
  "draft",
  "active",
  "disabled",
]);

export const inboxConnections = pgTable(
  "inbox_connections",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    channel: inboxChannelEnum("channel").notNull(),
    name: text("name").notNull(),
    status: inboxConnectionStatusEnum("status").default("draft").notNull(),
    externalAccountId: text("external_account_id"),
    externalIdentifiers: jsonb("external_identifiers")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    providerVersion: text("provider_version"),
    capabilities: jsonb("capabilities")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    lastVerifiedAt: timestamp("last_verified_at"),
    lastErrorCode: text("last_error_code"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("inbox_connections_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.channel,
    ),
    uniqueIndex("inbox_connections_active_external_number_idx")
      .on(table.channel, table.externalAccountId)
      .where(sql`${table.status} = 'active'`),
    check(
      "inbox_connections_name_length_check",
      sql`char_length(${table.name}) between 2 and 120`,
    ),
  ],
);

export const integrationSecretValues = pgTable(
  "integration_secret_values",
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("integration_secrets_connection_name_idx").on(
      table.tenantId,
      table.connectionId,
      table.logicalName,
    ),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [inboxConnections.tenantId, inboxConnections.id],
      name: "integration_secrets_connection_same_tenant_fk",
    }),
  ],
);

export const inboxWebhookRoutes = pgTable(
  "inbox_webhook_routes",
  {
    id: text("id").primaryKey(),
    publicKeyHash: text("public_key_hash").notNull().unique(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    provider: text("provider").notNull(),
    verificationSecretName: text("verification_secret_name"),
    verifierCiphertext: text("verifier_ciphertext"),
    verifierNonce: text("verifier_nonce"),
    verifierAuthenticationTag: text("verifier_authentication_tag"),
    verifierKeyVersion: integer("verifier_key_version"),
    active: boolean("active").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [inboxConnections.tenantId, inboxConnections.id],
      name: "inbox_webhook_routes_connection_same_tenant_fk",
    }),
  ],
);

export const webhookReceipts = pgTable(
  "inbox_webhook_receipts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    externalEventId: text("external_event_id"),
    bodyCiphertext: text("body_ciphertext").notNull(),
    bodyNonce: text("body_nonce").notNull(),
    bodyAuthenticationTag: text("body_authentication_tag").notNull(),
    bodyHash: text("body_hash").notNull(),
    keyVersion: integer("key_version").default(1).notNull(),
    contentType: text("content_type").notNull(),
    bodySize: integer("body_size").notNull(),
    status: inboxReceiptStatusEnum("status").default("received").notNull(),
    errorCode: text("error_code"),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [
    uniqueIndex("inbox_receipts_tenant_id_unique").on(table.tenantId, table.id),
    uniqueIndex("inbox_receipts_connection_event_idx")
      .on(table.connectionId, table.externalEventId)
      .where(sql`${table.externalEventId} is not null`),
    uniqueIndex("inbox_receipts_connection_hash_idx").on(
      table.connectionId,
      table.bodyHash,
    ),
    index("inbox_receipts_status_idx").on(table.status, table.receivedAt),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [inboxConnections.tenantId, inboxConnections.id],
      name: "inbox_receipts_connection_same_tenant_fk",
    }),
  ],
);

export const integrationJobs = pgTable(
  "inbox_integration_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id"),
    receiptId: text("receipt_id"),
    messageId: text("message_id"),
    type: text("type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: inboxJobStatusEnum("status").default("pending").notNull(),
    priority: integer("priority").default(0).notNull(),
    availableAt: timestamp("available_at").defaultNow().notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(8).notNull(),
    lockOwner: text("lock_owner"),
    lockedAt: timestamp("locked_at"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("inbox_jobs_idempotency_idx").on(table.idempotencyKey),
    index("inbox_jobs_claim_idx").on(table.status, table.availableAt, table.priority),
    index("inbox_jobs_message_idx")
      .on(table.tenantId, table.messageId)
      .where(sql`${table.messageId} is not null`),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [inboxConnections.tenantId, inboxConnections.id],
      name: "inbox_jobs_connection_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.receiptId],
      foreignColumns: [webhookReceipts.tenantId, webhookReceipts.id],
      name: "inbox_jobs_receipt_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.messageId],
      foreignColumns: [inboxMessages.tenantId, inboxMessages.id],
      name: "inbox_jobs_message_same_tenant_fk",
    }),
  ],
);

export const channelIdentities = pgTable(
  "inbox_channel_identities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    externalParticipantId: text("external_participant_id").notNull(),
    channel: inboxChannelEnum("channel").notNull(),
    contactId: text("contact_id"),
    externalDisplayName: text("external_display_name"),
    normalizedAddress: text("normalized_address"),
    status: inboxIdentityStatusEnum("status").default("unresolved").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("inbox_identities_connection_external_idx").on(
      table.connectionId,
      table.externalParticipantId,
    ),
    index("inbox_identities_contact_idx").on(table.tenantId, table.contactId),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [inboxConnections.tenantId, inboxConnections.id],
      name: "inbox_identities_connection_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "inbox_identities_contact_same_tenant_fk",
    }),
  ],
);

export const inboxConversations = pgTable(
  "inbox_conversations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    connectionId: text("connection_id").notNull(),
    channel: inboxChannelEnum("channel").notNull(),
    externalThreadId: text("external_thread_id").notNull(),
    identityId: text("identity_id"),
    contactId: text("contact_id"),
    opportunityId: text("opportunity_id"),
    assignedMembershipId: text("assigned_membership_id"),
    status: inboxConversationStatusEnum("status").default("open").notNull(),
    priority: inboxPriorityEnum("priority").default("normal").notNull(),
    subject: text("subject"),
    firstMessageAt: timestamp("first_message_at"),
    lastMessageAt: timestamp("last_message_at"),
    lastInboundAt: timestamp("last_inbound_at"),
    lastOutboundAt: timestamp("last_outbound_at"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("inbox_conversations_connection_thread_idx").on(
      table.connectionId,
      table.externalThreadId,
    ),
    index("inbox_conversations_list_idx").on(
      table.tenantId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("inbox_conversations_assignee_idx").on(
      table.tenantId,
      table.assignedMembershipId,
      table.updatedAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [inboxConnections.tenantId, inboxConnections.id],
      name: "inbox_conversations_connection_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.identityId],
      foreignColumns: [channelIdentities.tenantId, channelIdentities.id],
      name: "inbox_conversations_identity_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "inbox_conversations_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [salesOpportunities.tenantId, salesOpportunities.id],
      name: "inbox_conversations_opportunity_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.assignedMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "inbox_conversations_assignee_same_tenant_fk",
    }),
  ],
);

export const inboxMessages = pgTable(
  "inbox_messages",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    connectionId: text("connection_id").notNull(),
    direction: inboxDirectionEnum("direction").notNull(),
    kind: inboxMessageKindEnum("kind").notNull(),
    externalMessageId: text("external_message_id"),
    clientIdempotencyId: text("client_idempotency_id"),
    senderIdentityId: text("sender_identity_id"),
    senderMembershipId: text("sender_membership_id"),
    bodyText: text("body_text"),
    status: inboxMessageStatusEnum("status").default("received").notNull(),
    replyToMessageId: text("reply_to_message_id"),
    providerTimestamp: timestamp("provider_timestamp"),
    serverSequence: integer("server_sequence").notNull(),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("inbox_messages_external_idx")
      .on(table.connectionId, table.externalMessageId)
      .where(sql`${table.externalMessageId} is not null`),
    uniqueIndex("inbox_messages_client_idempotency_idx")
      .on(table.tenantId, table.clientIdempotencyId)
      .where(sql`${table.clientIdempotencyId} is not null`),
    index("inbox_messages_conversation_idx").on(
      table.tenantId,
      table.conversationId,
      table.serverSequence,
    ),
    foreignKey({
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [inboxConversations.tenantId, inboxConversations.id],
      name: "inbox_messages_conversation_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [inboxConnections.tenantId, inboxConnections.id],
      name: "inbox_messages_connection_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.senderIdentityId],
      foreignColumns: [channelIdentities.tenantId, channelIdentities.id],
      name: "inbox_messages_sender_identity_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.senderMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "inbox_messages_sender_membership_same_tenant_fk",
    }),
    check(
      "inbox_messages_body_limit_check",
      sql`${table.bodyText} is null or char_length(${table.bodyText}) <= 20000`,
    ),
  ],
);

export const messageStatusEvents = pgTable(
  "inbox_message_status_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    messageId: text("message_id").notNull(),
    externalEventId: text("external_event_id"),
    status: inboxMessageStatusEnum("status").notNull(),
    providerTimestamp: timestamp("provider_timestamp"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("inbox_status_events_external_idx")
      .on(table.messageId, table.externalEventId)
      .where(sql`${table.externalEventId} is not null`),
    foreignKey({
      columns: [table.tenantId, table.messageId],
      foreignColumns: [inboxMessages.tenantId, inboxMessages.id],
      name: "inbox_status_events_message_same_tenant_fk",
    }),
  ],
);
export const conversationAssignments = pgTable(
  "inbox_conversation_assignments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    previousMembershipId: text("previous_membership_id"),
    newMembershipId: text("new_membership_id"),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [inboxConversations.tenantId, inboxConversations.id],
      name: "inbox_assignments_conversation_same_tenant_fk",
    }),
  ],
);
export const conversationReads = pgTable(
  "inbox_conversation_reads",
  {
    tenantId: text("tenant_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    membershipId: text("membership_id").notNull(),
    lastReadSequence: integer("last_read_sequence").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.conversationId, table.membershipId] }),
    foreignKey({
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [inboxConversations.tenantId, inboxConversations.id],
      name: "inbox_reads_conversation_same_tenant_fk",
    }),
  ],
);
export const conversationInternalNotes = pgTable(
  "inbox_conversation_notes",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    bodyText: text("body_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [inboxConversations.tenantId, inboxConversations.id],
      name: "inbox_notes_conversation_same_tenant_fk",
    }),
    check(
      "inbox_notes_body_limit_check",
      sql`char_length(${table.bodyText}) between 1 and 5000`,
    ),
  ],
);
export const inboxAttachments = pgTable(
  "inbox_attachments",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    messageId: text("message_id").notNull(),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    declaredMime: text("declared_mime"),
    detectedMime: text("detected_mime"),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    status: text("status").default("available").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("inbox_attachments_message_idx").on(table.tenantId, table.messageId),
    foreignKey({
      columns: [table.tenantId, table.messageId],
      foreignColumns: [inboxMessages.tenantId, inboxMessages.id],
      name: "inbox_attachments_message_same_tenant_fk",
    }),
  ],
);

export const inboxForms = pgTable(
  "inbox_forms",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    publicKeyHash: text("public_key_hash").notNull().unique(),
    status: inboxFormStatusEnum("status").default("draft").notNull(),
    allowedDomains: jsonb("allowed_domains").$type<string[]>().default([]).notNull(),
    fields: jsonb("fields")
      .$type<Array<{ key: string; required: boolean }>>()
      .default([])
      .notNull(),
    consentText: text("consent_text"),
    sourceId: text("source_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("inbox_forms_status_idx").on(table.tenantId, table.status),
    foreignKey({
      columns: [table.tenantId, table.sourceId],
      foreignColumns: [salesLeadSources.tenantId, salesLeadSources.id],
      name: "inbox_forms_source_same_tenant_fk",
    }),
  ],
);

export const inboxRelations = relations(inboxConnections, ({ many }) => ({
  secrets: many(integrationSecretValues),
  routes: many(inboxWebhookRoutes),
  conversations: many(inboxConversations),
}));
