import { sql } from "drizzle-orm";
import {
  bigint,
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
import { user } from "./auth";
import { commercialAccounts, commercialContacts } from "./commercial-directory";
import { tenantMemberships, tenants } from "./tenancy";

export const salesRecordStatusEnum = pgEnum("sales_record_status", [
  "active",
  "archived",
]);
export const salesPipelineStatusEnum = pgEnum("sales_pipeline_status", [
  "active",
  "archived",
]);
export const salesOpportunityStateEnum = pgEnum("sales_opportunity_state", [
  "open",
  "won",
  "lost",
]);
export const salesPricingModelEnum = pgEnum("sales_pricing_model", [
  "fixed_price",
  "hourly",
  "retainer",
  "other",
]);
export const salesActivityTypeEnum = pgEnum("sales_activity_type", [
  "call",
  "meeting",
  "email",
  "whatsapp",
  "task",
  "note",
]);
export const salesActivityStatusEnum = pgEnum("sales_activity_status", [
  "planned",
  "completed",
  "cancelled",
]);
export const salesHistorySourceEnum = pgEnum("sales_history_source", [
  "manual",
  "kanban",
  "system",
  "import",
]);
export const salesParticipantRoleEnum = pgEnum("sales_participant_role", [
  "decision_maker",
  "influencer",
  "billing",
  "technical",
  "other",
]);

export const salesPipelines = pgTable(
  "sales_pipelines",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    description: text("description"),
    status: salesPipelineStatusEnum("status").default("active").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    templateKey: text("template_key"),
    templateVersion: integer("template_version"),
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
    uniqueIndex("sales_pipelines_active_name_unique")
      .on(table.tenantId, table.nameNormalized)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex("sales_pipelines_default_unique")
      .on(table.tenantId)
      .where(sql`${table.status} = 'active' and ${table.isDefault}`),
    index("sales_pipelines_tenant_status_idx").on(
      table.tenantId,
      table.status,
      table.updatedAt,
    ),
    check(
      "sales_pipelines_name_length_check",
      sql`char_length(${table.name}) between 2 and 120`,
    ),
    check(
      "sales_pipelines_description_length_check",
      sql`${table.description} is null or char_length(${table.description}) <= 1000`,
    ),
  ],
);

export const salesPipelineStages = pgTable(
  "sales_pipeline_stages",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    pipelineId: text("pipeline_id").notNull(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    color: text("color").notNull(),
    position: bigint("position", { mode: "number" }).notNull(),
    defaultProbability: integer("default_probability").notNull(),
    staleAfterDays: integer("stale_after_days"),
    isInitial: boolean("is_initial").default(false).notNull(),
    status: salesRecordStatusEnum("status").default("active").notNull(),
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
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("sales_stages_pipeline_id_unique").on(
      table.tenantId,
      table.pipelineId,
      table.id,
    ),
    uniqueIndex("sales_stages_active_name_unique")
      .on(table.tenantId, table.pipelineId, table.nameNormalized)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex("sales_stages_initial_unique")
      .on(table.tenantId, table.pipelineId)
      .where(sql`${table.status} = 'active' and ${table.isInitial}`),
    index("sales_stages_pipeline_position_idx").on(
      table.tenantId,
      table.pipelineId,
      table.status,
      table.position,
    ),
    foreignKey({
      columns: [table.tenantId, table.pipelineId],
      foreignColumns: [salesPipelines.tenantId, salesPipelines.id],
      name: "sales_stages_pipeline_same_tenant_fk",
    }),
    check(
      "sales_stages_probability_check",
      sql`${table.defaultProbability} between 0 and 100`,
    ),
    check(
      "sales_stages_stale_days_check",
      sql`${table.staleAfterDays} is null or ${table.staleAfterDays} > 0`,
    ),
    check("sales_stages_color_check", sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`),
    check(
      "sales_stages_name_length_check",
      sql`char_length(${table.name}) between 1 and 80`,
    ),
  ],
);

export const salesLeadSources = pgTable(
  "sales_lead_sources",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    status: salesRecordStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("sales_sources_key_unique").on(table.tenantId, table.key),
    index("sales_sources_status_idx").on(table.tenantId, table.status, table.name),
  ],
);

export const salesLostReasons = pgTable(
  "sales_lost_reasons",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    status: salesRecordStatusEnum("status").default("active").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("sales_lost_reasons_key_unique").on(table.tenantId, table.key),
    index("sales_lost_reasons_status_idx").on(
      table.tenantId,
      table.status,
      table.position,
    ),
  ],
);

export const salesOpportunities = pgTable(
  "sales_opportunities",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    pipelineId: text("pipeline_id").notNull(),
    stageId: text("stage_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    primaryContactId: text("primary_contact_id"),
    accountId: text("account_id"),
    ownerMembershipId: text("owner_membership_id").notNull(),
    sourceId: text("source_id"),
    state: salesOpportunityStateEnum("state").default("open").notNull(),
    recordStatus: salesRecordStatusEnum("record_status").default("active").notNull(),
    pricingModel: salesPricingModelEnum("pricing_model").notNull(),
    currency: text("currency").notNull(),
    estimatedValueMinor: bigint("estimated_value_minor", { mode: "number" }).notNull(),
    hourlyRateMinor: bigint("hourly_rate_minor", { mode: "number" }),
    estimatedHours: integer("estimated_hours"),
    retainerMonthlyMinor: bigint("retainer_monthly_minor", { mode: "number" }),
    retainerDurationMonths: integer("retainer_duration_months"),
    pricingExplanation: text("pricing_explanation"),
    probabilityOverride: integer("probability_override"),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: false }),
    position: bigint("position", { mode: "number" }).notNull(),
    stageChangedAt: timestamp("stage_changed_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    finalValueMinor: bigint("final_value_minor", { mode: "number" }),
    lostReasonId: text("lost_reason_id"),
    lostExplanation: text("lost_explanation"),
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
    index("sales_opportunities_board_idx").on(
      table.tenantId,
      table.pipelineId,
      table.stageId,
      table.state,
      table.recordStatus,
      table.position,
    ),
    index("sales_opportunities_owner_state_idx").on(
      table.tenantId,
      table.ownerMembershipId,
      table.state,
      table.updatedAt,
    ),
    index("sales_opportunities_expected_close_idx").on(
      table.tenantId,
      table.state,
      table.expectedCloseDate,
    ),
    index("sales_opportunities_contact_idx").on(table.tenantId, table.primaryContactId),
    index("sales_opportunities_account_idx").on(table.tenantId, table.accountId),
    foreignKey({
      columns: [table.tenantId, table.pipelineId],
      foreignColumns: [salesPipelines.tenantId, salesPipelines.id],
      name: "sales_opportunities_pipeline_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.pipelineId, table.stageId],
      foreignColumns: [
        salesPipelineStages.tenantId,
        salesPipelineStages.pipelineId,
        salesPipelineStages.id,
      ],
      name: "sales_opportunities_stage_same_pipeline_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.primaryContactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "sales_opportunities_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "sales_opportunities_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.ownerMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "sales_opportunities_owner_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.sourceId],
      foreignColumns: [salesLeadSources.tenantId, salesLeadSources.id],
      name: "sales_opportunities_source_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.lostReasonId],
      foreignColumns: [salesLostReasons.tenantId, salesLostReasons.id],
      name: "sales_opportunities_lost_reason_same_tenant_fk",
    }),
    check(
      "sales_opportunities_title_length_check",
      sql`char_length(${table.title}) between 2 and 200`,
    ),
    check(
      "sales_opportunities_summary_length_check",
      sql`${table.summary} is null or char_length(${table.summary}) <= 5000`,
    ),
    check("sales_opportunities_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "sales_opportunities_estimated_value_check",
      sql`${table.estimatedValueMinor} >= 0`,
    ),
    check(
      "sales_opportunities_probability_check",
      sql`${table.probabilityOverride} is null or ${table.probabilityOverride} between 0 and 100`,
    ),
    check(
      "sales_opportunities_contact_or_account_check",
      sql`${table.primaryContactId} is not null or ${table.accountId} is not null`,
    ),
    check(
      "sales_opportunities_open_terminal_fields_check",
      sql`${table.state} <> 'open' or (${table.closedAt} is null and ${table.finalValueMinor} is null and ${table.lostReasonId} is null)`,
    ),
    check(
      "sales_opportunities_won_fields_check",
      sql`${table.state} <> 'won' or (${table.closedAt} is not null and ${table.lostReasonId} is null)`,
    ),
    check(
      "sales_opportunities_lost_fields_check",
      sql`${table.state} <> 'lost' or (${table.closedAt} is not null and ${table.lostReasonId} is not null)`,
    ),
    check(
      "sales_opportunities_pricing_values_check",
      sql`${table.hourlyRateMinor} is null or ${table.hourlyRateMinor} >= 0`,
    ),
  ],
);

export const salesOpportunityParticipants = pgTable(
  "sales_opportunity_participants",
  {
    tenantId: text("tenant_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    contactId: text("contact_id").notNull(),
    role: salesParticipantRoleEnum("role").default("other").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.opportunityId, table.contactId] }),
    uniqueIndex("sales_opportunity_primary_participant_unique")
      .on(table.tenantId, table.opportunityId)
      .where(sql`${table.isPrimary}`),
    foreignKey({
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [salesOpportunities.tenantId, salesOpportunities.id],
      name: "sales_participants_opportunity_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "sales_participants_contact_same_tenant_fk",
    }),
  ],
);

export const salesStageHistory = pgTable(
  "sales_stage_history",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    pipelineId: text("pipeline_id").notNull(),
    fromStageId: text("from_stage_id"),
    toStageId: text("to_stage_id").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    source: salesHistorySourceEnum("source").notNull(),
    resultingVersion: integer("resulting_version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sales_stage_history_opportunity_idx").on(
      table.tenantId,
      table.opportunityId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [salesOpportunities.tenantId, salesOpportunities.id],
      name: "sales_stage_history_opportunity_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.pipelineId],
      foreignColumns: [salesPipelines.tenantId, salesPipelines.id],
      name: "sales_stage_history_pipeline_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.pipelineId, table.toStageId],
      foreignColumns: [
        salesPipelineStages.tenantId,
        salesPipelineStages.pipelineId,
        salesPipelineStages.id,
      ],
      name: "sales_stage_history_to_stage_same_pipeline_fk",
    }),
  ],
);

export const salesStateHistory = pgTable(
  "sales_state_history",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    fromState: salesOpportunityStateEnum("from_state"),
    toState: salesOpportunityStateEnum("to_state").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    reasonId: text("reason_id"),
    explanation: text("explanation"),
    resultingVersion: integer("resulting_version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sales_state_history_opportunity_idx").on(
      table.tenantId,
      table.opportunityId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [salesOpportunities.tenantId, salesOpportunities.id],
      name: "sales_state_history_opportunity_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.reasonId],
      foreignColumns: [salesLostReasons.tenantId, salesLostReasons.id],
      name: "sales_state_history_reason_same_tenant_fk",
    }),
    check(
      "sales_state_history_explanation_length_check",
      sql`${table.explanation} is null or char_length(${table.explanation}) <= 1000`,
    ),
  ],
);

export const salesActivities = pgTable(
  "sales_activities",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    contactId: text("contact_id"),
    accountId: text("account_id"),
    type: salesActivityTypeEnum("type").notNull(),
    status: salesActivityStatusEnum("status").default("planned").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    scheduledAt: timestamp("scheduled_at"),
    ownerMembershipId: text("owner_membership_id").notNull(),
    completedAt: timestamp("completed_at"),
    result: text("result"),
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
    index("sales_activities_opportunity_status_date_idx").on(
      table.tenantId,
      table.opportunityId,
      table.status,
      table.scheduledAt,
    ),
    index("sales_activities_owner_status_date_idx").on(
      table.tenantId,
      table.ownerMembershipId,
      table.status,
      table.scheduledAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [salesOpportunities.tenantId, salesOpportunities.id],
      name: "sales_activities_opportunity_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.contactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "sales_activities_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.accountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "sales_activities_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.ownerMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "sales_activities_owner_same_tenant_fk",
    }),
    check(
      "sales_activities_title_length_check",
      sql`char_length(${table.title}) between 1 and 200`,
    ),
    check(
      "sales_activities_description_length_check",
      sql`${table.description} is null or char_length(${table.description}) <= 5000`,
    ),
    check(
      "sales_activities_result_length_check",
      sql`${table.result} is null or char_length(${table.result}) <= 2000`,
    ),
    check(
      "sales_activities_planned_fields_check",
      sql`${table.status} <> 'planned' or ${table.scheduledAt} is not null`,
    ),
    check(
      "sales_activities_completed_fields_check",
      sql`${table.status} <> 'completed' or ${table.completedAt} is not null`,
    ),
  ],
);

export const salesDomainEvents = pgTable(
  "sales_domain_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    schemaVersion: integer("schema_version").default(1).notNull(),
    opportunityId: text("opportunity_id").notNull(),
    payload: text("payload").notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sales_domain_events_tenant_opportunity_type_unique").on(
      table.tenantId,
      table.opportunityId,
      table.eventType,
    ),
    index("sales_domain_events_tenant_occurred_idx").on(
      table.tenantId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [salesOpportunities.tenantId, salesOpportunities.id],
      name: "sales_domain_events_opportunity_same_tenant_fk",
    }),
  ],
);
