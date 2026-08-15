import { sql } from "drizzle-orm";
import {
  boolean,
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
import { projects } from "./projects";
import { tenantMemberships, tenants } from "./tenancy";
import { user } from "./auth";

const instant = (name: string) => timestamp(name, { withTimezone: true });
export const portalAccessStatusEnum = pgEnum("portal_access_status", [
  "invited",
  "active",
  "suspended",
  "revoked",
]);
export const portalInvitationStatusEnum = pgEnum("portal_invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);
export const portalDomainStatusEnum = pgEnum("portal_domain_status", [
  "draft",
  "pending_verification",
  "verified",
  "active",
  "disabled",
]);
export const portalMessageStatusEnum = pgEnum("portal_message_status", [
  "sent",
  "read",
  "archived",
]);
export const portalDecisionEnum = pgEnum("portal_decision", [
  "approved",
  "changes_requested",
]);

export const portalBrandProfiles = pgTable(
  "portal_brand_profiles",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    brandName: text("brand_name").notNull(),
    logoObjectKey: text("logo_object_key"),
    primaryColor: text("primary_color").default("#2457D6").notNull(),
    accentColor: text("accent_color").default("#18212F").notNull(),
    supportLabel: text("support_label").default("Soporte de la agencia").notNull(),
    status: text("status").default("draft").notNull(),
    version: integer("version").default(1).notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("portal_brand_tenant_unique").on(table.tenantId),
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: "portal_brand_tenant_fk",
    }),
  ],
);

export const portalDomains = pgTable(
  "portal_domains",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    hostname: text("hostname").notNull(),
    status: portalDomainStatusEnum("status").default("draft").notNull(),
    verificationTokenHash: text("verification_token_hash"),
    verifiedAt: instant("verified_at"),
    activeAt: instant("active_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("portal_domain_hostname_unique").on(table.hostname),
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: "portal_domain_tenant_fk",
    }),
  ],
);

export const portalAccesses = pgTable(
  "portal_accesses",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    accountId: text("account_id").notNull(),
    contactId: text("contact_id"),
    status: portalAccessStatusEnum("status").default("invited").notNull(),
    locale: text("locale").default("es-MX").notNull(),
    timezone: text("timezone").default("America/Tijuana").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    activatedAt: instant("activated_at"),
    revokedAt: instant("revoked_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("portal_access_user_account_unique").on(
      table.tenantId,
      table.userId,
      table.accountId,
    ),
    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: "portal_access_tenant_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "portal_access_user_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "portal_access_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "portal_access_contact_same_tenant_fk",
    }),
  ],
);

export const portalAccessProjectScopes = pgTable(
  "portal_access_project_scopes",
  {
    tenantId: text("tenant_id").notNull(),
    accessId: text("access_id").notNull(),
    projectId: text("project_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.accessId, table.projectId] }),
    foreignKey({
      columns: [table.tenantId, table.accessId],
      foreignColumns: [portalAccesses.tenantId, portalAccesses.id],
      name: "portal_scope_access_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "portal_scope_project_same_tenant_fk",
    }),
  ],
);

export const portalInvitations = pgTable(
  "portal_invitations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    accountId: text("account_id").notNull(),
    contactId: text("contact_id"),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: portalInvitationStatusEnum("status").default("pending").notNull(),
    expiresAt: instant("expires_at").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    acceptedUserId: text("accepted_user_id"),
    acceptedAccessId: text("accepted_access_id"),
    acceptedAt: instant("accepted_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("portal_invitation_token_unique").on(table.tokenHash),
    index("portal_invitation_pending_idx").on(
      table.tenantId,
      table.status,
      table.expiresAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "portal_invitation_account_same_tenant_fk",
    }),
  ],
);

export const portalProjectConversations = pgTable(
  "portal_project_conversations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("portal_project_conversation_unique").on(
      table.tenantId,
      table.projectId,
    ),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "portal_conversation_project_same_tenant_fk",
    }),
  ],
);
export const portalMessages = pgTable(
  "portal_messages",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    body: text("body").notNull(),
    status: portalMessageStatusEnum("status").default("sent").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    readAt: instant("read_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [
        portalProjectConversations.tenantId,
        portalProjectConversations.id,
      ],
      name: "portal_message_conversation_same_tenant_fk",
    }),
  ],
);
export const portalDeliverables = pgTable(
  "portal_deliverables",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").default("draft").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "portal_deliverable_project_same_tenant_fk",
    }),
  ],
);
export const portalDeliverableVersions = pgTable(
  "portal_deliverable_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    deliverableId: text("deliverable_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    objectKey: text("object_key"),
    contentHash: text("content_hash").notNull(),
    publishedAt: instant("published_at"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("portal_deliverable_version_unique").on(
      table.tenantId,
      table.deliverableId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.tenantId, table.deliverableId],
      foreignColumns: [portalDeliverables.tenantId, portalDeliverables.id],
      name: "portal_deliverable_version_same_tenant_fk",
    }),
  ],
);
export const portalDeliverableDecisions = pgTable(
  "portal_deliverable_decisions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    deliverableVersionId: text("deliverable_version_id").notNull(),
    accessId: text("access_id").notNull(),
    decision: portalDecisionEnum("decision").notNull(),
    comment: text("comment"),
    decisionHash: text("decision_hash").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("portal_deliverable_decision_unique").on(
      table.tenantId,
      table.deliverableVersionId,
      table.accessId,
    ),
    foreignKey({
      columns: [table.tenantId, table.deliverableVersionId],
      foreignColumns: [
        portalDeliverableVersions.tenantId,
        portalDeliverableVersions.id,
      ],
      name: "portal_decision_version_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.accessId],
      foreignColumns: [portalAccesses.tenantId, portalAccesses.id],
      name: "portal_decision_access_same_tenant_fk",
    }),
  ],
);
export const portalOutboxEvents = pgTable(
  "portal_outbox_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("portal_outbox_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);
