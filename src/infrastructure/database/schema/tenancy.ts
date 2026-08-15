import { relations } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

export const tenantStatusEnum = pgEnum("tenant_status", ["active", "suspended"]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "suspended",
  "revoked",
]);
export const tenantRoleEnum = pgEnum("tenant_role", [
  "tenant_admin",
  "sales",
  "execution",
  "finance",
  "client",
]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);
export const auditResultEnum = pgEnum("audit_result", ["success", "denied"]);

export const platformAdministrators = pgTable("platform_administrators", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdByUserId: text("created_by_user_id").references(() => user.id, {
    onDelete: "restrict",
  }),
});

export const tenants = pgTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull(),
    status: tenantStatusEnum("status").default("active").notNull(),
    timezone: text("timezone").default("America/Tijuana").notNull(),
    locale: text("locale").default("es-MX").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("tenants_slug_unique").on(table.slug),
    index("tenants_status_idx").on(table.status),
    check(
      "tenants_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
  ],
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: membershipStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    suspendedAt: timestamp("suspended_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("tenant_memberships_tenant_user_unique").on(
      table.tenantId,
      table.userId,
    ),
    index("tenant_memberships_tenant_status_idx").on(table.tenantId, table.status),
    index("tenant_memberships_user_status_idx").on(table.userId, table.status),
    uniqueIndex("tenant_memberships_tenant_id_unique").on(table.tenantId, table.id),
  ],
);

export const tenantMembershipRoles = pgTable(
  "tenant_membership_roles",
  {
    membershipId: text("membership_id")
      .notNull()
      .references(() => tenantMemberships.id, { onDelete: "restrict" }),
    role: tenantRoleEnum("role").notNull(),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    assignedByUserId: text("assigned_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [primaryKey({ columns: [table.membershipId, table.role] })],
);

export const tenantInvitations = pgTable(
  "tenant_invitations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: invitationStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastSentAt: timestamp("last_sent_at"),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    acceptedAt: timestamp("accepted_at"),
  },
  (table) => [
    uniqueIndex("tenant_invitations_token_hash_unique").on(table.tokenHash),
    uniqueIndex("tenant_invitations_pending_email_unique")
      .on(table.tenantId, table.email)
      .where(sql`${table.status} = 'pending'`),
    index("tenant_invitations_tenant_status_idx").on(table.tenantId, table.status),
    index("tenant_invitations_expiry_idx").on(table.expiresAt, table.status),
    check(
      "tenant_invitations_email_normalized_check",
      sql`${table.email} = lower(${table.email})`,
    ),
  ],
);

export const tenantInvitationRoles = pgTable(
  "tenant_invitation_roles",
  {
    invitationId: text("invitation_id")
      .notNull()
      .references(() => tenantInvitations.id, { onDelete: "restrict" }),
    role: tenantRoleEnum("role").notNull(),
  },
  (table) => [primaryKey({ columns: [table.invitationId, table.role] })],
);

export const securityAuditEvents = pgTable(
  "security_audit_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    eventType: text("event_type").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    result: auditResultEnum("result").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    requestId: text("request_id"),
  },
  (table) => [
    index("security_audit_events_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
    index("security_audit_events_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("security_audit_events_target_idx").on(table.targetType, table.targetId),
  ],
);

export const tenancyRelations = relations(tenants, ({ many }) => ({
  memberships: many(tenantMemberships),
  invitations: many(tenantInvitations),
  auditEvents: many(securityAuditEvents),
}));

export const membershipRelations = relations(tenantMemberships, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantMemberships.tenantId],
    references: [tenants.id],
  }),
  user: one(user, { fields: [tenantMemberships.userId], references: [user.id] }),
  roles: many(tenantMembershipRoles),
}));

export const membershipRoleRelations = relations(tenantMembershipRoles, ({ one }) => ({
  membership: one(tenantMemberships, {
    fields: [tenantMembershipRoles.membershipId],
    references: [tenantMemberships.id],
  }),
}));

export const invitationRelations = relations(tenantInvitations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantInvitations.tenantId],
    references: [tenants.id],
  }),
  roles: many(tenantInvitationRoles),
}));

export const invitationRoleRelations = relations(tenantInvitationRoles, ({ one }) => ({
  invitation: one(tenantInvitations, {
    fields: [tenantInvitationRoles.invitationId],
    references: [tenantInvitations.id],
  }),
}));
