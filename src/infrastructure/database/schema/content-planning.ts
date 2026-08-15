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
import { commercialAccounts } from "./commercial-directory";
import { projects } from "./projects";
import { tenantMemberships, tenants } from "./tenancy";

const instant = (name: string) => timestamp(name, { withTimezone: true });
export const editorialStatusEnum = pgEnum("editorial_status", [
  "active",
  "inactive",
  "archived",
]);
export const ideaStatusEnum = pgEnum("content_idea_status", [
  "backlog",
  "selected",
  "converted",
  "archived",
]);
export const contentStateEnum = pgEnum("content_state", [
  "idea",
  "brief",
  "in_production",
  "internal_review",
  "client_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "archived",
]);
export const editorialChannelEnum = pgEnum("editorial_channel", [
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "blog",
  "email",
  "other",
]);
export const editorialReviewDecisionEnum = pgEnum("editorial_review_decision", [
  "approved",
  "changes_requested",
]);

export const editorialBrands = pgTable(
  "editorial_brands",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    accountId: text("account_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    brandType: text("brand_type").notNull(),
    description: text("description"),
    tone: text("tone"),
    locale: text("locale").default("es-MX").notNull(),
    timezone: text("timezone").default("America/Tijuana").notNull(),
    status: editorialStatusEnum("status").default("active").notNull(),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("editorial_brand_slug_unique").on(table.tenantId, table.slug),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "editorial_brand_account_same_tenant_fk",
    }),
  ],
);
export const editorialCampaigns = pgTable(
  "editorial_campaigns",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    name: text("name").notNull(),
    objective: text("objective"),
    status: editorialStatusEnum("status").default("active").notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.brandId],
      foreignColumns: [editorialBrands.tenantId, editorialBrands.id],
      name: "editorial_campaign_brand_same_tenant_fk",
    }),
  ],
);
export const editorialPillars = pgTable(
  "editorial_pillars",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: editorialStatusEnum("status").default("active").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.brandId],
      foreignColumns: [editorialBrands.tenantId, editorialBrands.id],
      name: "editorial_pillar_brand_same_tenant_fk",
    }),
  ],
);
export const contentIdeas = pgTable(
  "content_ideas",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id"),
    accountId: text("account_id"),
    title: text("title").notNull(),
    body: text("body"),
    status: ideaStatusEnum("status").default("backlog").notNull(),
    priority: integer("priority").default(0).notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("content_ideas_backlog_idx").on(table.tenantId, table.status, table.priority),
    foreignKey({
      columns: [table.tenantId, table.brandId],
      foreignColumns: [editorialBrands.tenantId, editorialBrands.id],
      name: "content_idea_brand_same_tenant_fk",
    }),
  ],
);
export const contentNotes = pgTable(
  "content_notes",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    accountId: text("account_id"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    archivedAt: instant("archived_at"),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.id] })],
);
export const contentItems = pgTable(
  "content_items",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    brandId: text("brand_id").notNull(),
    campaignId: text("campaign_id"),
    pillarId: text("pillar_id"),
    projectId: text("project_id"),
    title: text("title").notNull(),
    objective: text("objective"),
    audience: text("audience"),
    keyMessage: text("key_message"),
    state: contentStateEnum("state").default("idea").notNull(),
    plannedDate: text("planned_date"),
    timezone: text("timezone").default("America/Tijuana").notNull(),
    ownerMembershipId: text("owner_membership_id"),
    sourceIdeaId: text("source_idea_id"),
    sourceNoteId: text("source_note_id"),
    version: integer("version").default(1).notNull(),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    index("content_items_calendar_idx").on(
      table.tenantId,
      table.plannedDate,
      table.state,
    ),
    foreignKey({
      columns: [table.tenantId, table.brandId],
      foreignColumns: [editorialBrands.tenantId, editorialBrands.id],
      name: "content_item_brand_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.campaignId],
      foreignColumns: [editorialCampaigns.tenantId, editorialCampaigns.id],
      name: "content_item_campaign_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.pillarId],
      foreignColumns: [editorialPillars.tenantId, editorialPillars.id],
      name: "content_item_pillar_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "content_item_project_same_tenant_fk",
    }),
  ],
);
export const contentVariants = pgTable(
  "content_variants",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    contentItemId: text("content_item_id").notNull(),
    channel: editorialChannelEnum("channel").notNull(),
    format: text("format").notNull(),
    copyText: text("copy_text"),
    storyboard: text("storyboard"),
    visualDirection: text("visual_direction"),
    plannedAt: instant("planned_at"),
    timezone: text("timezone").default("America/Tijuana").notNull(),
    position: bigint("position", { mode: "bigint" })
      .default(sql`1024`)
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("content_variant_channel_unique").on(
      table.tenantId,
      table.contentItemId,
      table.channel,
    ),
    foreignKey({
      columns: [table.tenantId, table.contentItemId],
      foreignColumns: [contentItems.tenantId, contentItems.id],
      name: "content_variant_item_same_tenant_fk",
    }),
  ],
);
export const contentReviews = pgTable(
  "content_reviews",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    contentItemId: text("content_item_id").notNull(),
    reviewerMembershipId: text("reviewer_membership_id").notNull(),
    decision: editorialReviewDecisionEnum("decision").notNull(),
    comment: text("comment"),
    version: integer("version").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.contentItemId],
      foreignColumns: [contentItems.tenantId, contentItems.id],
      name: "content_review_item_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.reviewerMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "content_review_reviewer_same_tenant_fk",
    }),
  ],
);
export const contentOutboxEvents = pgTable(
  "content_outbox_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("content_outbox_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);
