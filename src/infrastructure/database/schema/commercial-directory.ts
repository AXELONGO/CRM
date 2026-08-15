import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenantMemberships, tenants } from "./tenancy";
import { user } from "./auth";

export const commercialStatusEnum = pgEnum("commercial_status", ["active", "archived"]);
export const contactMethodTypeEnum = pgEnum("contact_method_type", [
  "email",
  "phone",
  "whatsapp",
]);
export const contactMethodLabelEnum = pgEnum("contact_method_label", [
  "work",
  "personal",
  "other",
]);
export const accountContactTypeEnum = pgEnum("account_contact_type", [
  "decision_maker",
  "billing",
  "technical",
  "employee",
  "other",
]);
export const communicationChannelEnum = pgEnum("communication_channel", [
  "email",
  "phone",
  "whatsapp",
]);
export const communicationPurposeEnum = pgEnum("communication_purpose", [
  "service",
  "marketing",
]);
export const communicationEventStatusEnum = pgEnum("communication_event_status", [
  "granted",
  "denied",
  "revoked",
]);
export const communicationEventSourceEnum = pgEnum("communication_event_source", [
  "manual",
  "form",
  "import",
  "provider",
]);

export const commercialAccounts = pgTable(
  "crm_accounts",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    displayNameNormalized: text("display_name_normalized").notNull(),
    legalName: text("legal_name"),
    website: text("website"),
    industry: text("industry"),
    ownerMembershipId: text("owner_membership_id"),
    status: commercialStatusEnum("status").default("active").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    archivedByUserId: text("archived_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("crm_accounts_tenant_status_updated_idx").on(
      table.tenantId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("crm_accounts_tenant_owner_idx").on(table.tenantId, table.ownerMembershipId),
    index("crm_accounts_tenant_name_idx").on(
      table.tenantId,
      table.displayNameNormalized,
    ),
    foreignKey({
      columns: [table.tenantId, table.ownerMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "crm_accounts_owner_same_tenant_fk",
    }),
    check(
      "crm_accounts_display_name_length_check",
      sql`char_length(${table.displayName}) between 2 and 160`,
    ),
    check(
      "crm_accounts_website_length_check",
      sql`${table.website} is null or char_length(${table.website}) <= 2048`,
    ),
  ],
);

export const commercialContacts = pgTable(
  "crm_contacts",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    displayNameNormalized: text("display_name_normalized").notNull(),
    givenName: text("given_name"),
    familyName: text("family_name"),
    ownerMembershipId: text("owner_membership_id"),
    status: commercialStatusEnum("status").default("active").notNull(),
    doNotContact: boolean("do_not_contact").default(false).notNull(),
    doNotContactReason: text("do_not_contact_reason"),
    doNotContactAt: timestamp("do_not_contact_at"),
    doNotContactByUserId: text("do_not_contact_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    archivedByUserId: text("archived_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("crm_contacts_tenant_status_updated_idx").on(
      table.tenantId,
      table.status,
      table.updatedAt,
      table.id,
    ),
    index("crm_contacts_tenant_owner_idx").on(table.tenantId, table.ownerMembershipId),
    index("crm_contacts_tenant_name_idx").on(
      table.tenantId,
      table.displayNameNormalized,
    ),
    foreignKey({
      columns: [table.tenantId, table.ownerMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "crm_contacts_owner_same_tenant_fk",
    }),
    check(
      "crm_contacts_display_name_length_check",
      sql`char_length(${table.displayName}) between 2 and 160`,
    ),
    check(
      "crm_contacts_do_not_contact_reason_check",
      sql`${table.doNotContactReason} is null or char_length(${table.doNotContactReason}) <= 500`,
    ),
    check(
      "crm_contacts_do_not_contact_consistency_check",
      sql`${table.doNotContact} or ${table.doNotContactReason} is null`,
    ),
  ],
);

export const contactMethods = pgTable(
  "crm_contact_methods",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    contactId: text("contact_id").notNull(),
    type: contactMethodTypeEnum("type").notNull(),
    label: contactMethodLabelEnum("label").default("other").notNull(),
    originalValue: text("original_value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    status: commercialStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("crm_contact_methods_value_unique").on(
      table.tenantId,
      table.contactId,
      table.type,
      table.normalizedValue,
    ),
    uniqueIndex("crm_contact_methods_primary_unique")
      .on(table.tenantId, table.contactId, table.type)
      .where(sql`${table.isPrimary} and ${table.status} = 'active'`),
    index("crm_contact_methods_search_idx").on(
      table.tenantId,
      table.type,
      table.normalizedValue,
    ),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "crm_contact_methods_contact_same_tenant_fk",
    }),
  ],
);

export const accountContacts = pgTable(
  "crm_account_contacts",
  {
    tenantId: text("tenant_id").notNull(),
    contactId: text("contact_id").notNull(),
    accountId: text("account_id").notNull(),
    title: text("title"),
    department: text("department"),
    relationshipType: accountContactTypeEnum("relationship_type")
      .default("other")
      .notNull(),
    isPrimaryContact: boolean("is_primary_contact").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.contactId, table.accountId] }),
    uniqueIndex("crm_account_contacts_primary_unique")
      .on(table.tenantId, table.accountId)
      .where(sql`${table.isPrimaryContact}`),
    index("crm_account_contacts_contact_idx").on(table.tenantId, table.contactId),
    index("crm_account_contacts_account_idx").on(table.tenantId, table.accountId),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "crm_account_contacts_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "crm_account_contacts_account_same_tenant_fk",
    }),
  ],
);

export const commercialTags = pgTable(
  "crm_tags",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    color: text("color"),
    status: commercialStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("crm_tags_tenant_name_unique").on(table.tenantId, table.nameNormalized),
    index("crm_tags_tenant_status_idx").on(table.tenantId, table.status),
    check(
      "crm_tags_name_length_check",
      sql`char_length(${table.name}) between 1 and 80`,
    ),
    check(
      "crm_tags_color_check",
      sql`${table.color} is null or ${table.color} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
  ],
);

export const contactTags = pgTable(
  "crm_contact_tags",
  {
    tenantId: text("tenant_id").notNull(),
    contactId: text("contact_id").notNull(),
    tagId: text("tag_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.contactId, table.tagId] }),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "crm_contact_tags_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.tagId],
      foreignColumns: [commercialTags.tenantId, commercialTags.id],
      name: "crm_contact_tags_tag_same_tenant_fk",
    }),
  ],
);

export const accountTags = pgTable(
  "crm_account_tags",
  {
    tenantId: text("tenant_id").notNull(),
    accountId: text("account_id").notNull(),
    tagId: text("tag_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.accountId, table.tagId] }),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "crm_account_tags_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.tagId],
      foreignColumns: [commercialTags.tenantId, commercialTags.id],
      name: "crm_account_tags_tag_same_tenant_fk",
    }),
  ],
);

export const contactNotes = pgTable(
  "crm_contact_notes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    contactId: text("contact_id").notNull(),
    authorMembershipId: text("author_membership_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    editedAt: timestamp("edited_at"),
    archivedAt: timestamp("archived_at"),
    editedByUserId: text("edited_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    archivedByUserId: text("archived_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    uniqueIndex("crm_contact_notes_tenant_id_unique").on(table.tenantId, table.id),
    index("crm_contact_notes_entity_idx").on(
      table.tenantId,
      table.contactId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "crm_contact_notes_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.authorMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "crm_contact_notes_author_same_tenant_fk",
    }),
    check(
      "crm_contact_notes_body_length_check",
      sql`char_length(${table.body}) between 1 and 10000`,
    ),
  ],
);

export const accountNotes = pgTable(
  "crm_account_notes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    accountId: text("account_id").notNull(),
    authorMembershipId: text("author_membership_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    editedAt: timestamp("edited_at"),
    archivedAt: timestamp("archived_at"),
    editedByUserId: text("edited_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    archivedByUserId: text("archived_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    uniqueIndex("crm_account_notes_tenant_id_unique").on(table.tenantId, table.id),
    index("crm_account_notes_entity_idx").on(
      table.tenantId,
      table.accountId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "crm_account_notes_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.authorMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "crm_account_notes_author_same_tenant_fk",
    }),
    check(
      "crm_account_notes_body_length_check",
      sql`char_length(${table.body}) between 1 and 10000`,
    ),
  ],
);

export const communicationConsentEvents = pgTable(
  "crm_communication_consent_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    contactId: text("contact_id").notNull(),
    channel: communicationChannelEnum("channel").notNull(),
    purpose: communicationPurposeEnum("purpose").notNull(),
    status: communicationEventStatusEnum("status").notNull(),
    source: communicationEventSourceEnum("source").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    recordedByUserId: text("recorded_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    evidenceReference: text("evidence_reference"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("crm_consent_contact_channel_purpose_idx").on(
      table.tenantId,
      table.contactId,
      table.channel,
      table.purpose,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "crm_consent_contact_same_tenant_fk",
    }),
    check(
      "crm_consent_evidence_length_check",
      sql`${table.evidenceReference} is null or char_length(${table.evidenceReference}) <= 500`,
    ),
  ],
);

export const commercialAuditEvents = pgTable(
  "crm_commercial_audit_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    changedFields: text("changed_fields")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("crm_audit_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("crm_audit_entity_idx").on(
      table.tenantId,
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  ],
);

export const commercialDirectoryRelations = relations(
  commercialContacts,
  ({ many }) => ({
    methods: many(contactMethods),
    accounts: many(accountContacts),
    notes: many(contactNotes),
    consentEvents: many(communicationConsentEvents),
  }),
);
