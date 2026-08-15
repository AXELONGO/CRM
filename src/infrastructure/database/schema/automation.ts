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
  time,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { inboxConversations } from "./inbox";
import { salesOpportunities } from "./sales";
import { tenantMemberships, tenants } from "./tenancy";
import { user } from "./auth";

const instant = (name: string) => timestamp(name, { withTimezone: true });
export const automationRuleStatusEnum = pgEnum("automation_rule_status", [
  "draft",
  "active",
  "paused",
  "archived",
]);
export const automationRunStatusEnum = pgEnum("automation_run_status", [
  "matched",
  "not_matched",
  "running",
  "succeeded",
  "partial",
  "failed",
  "cancelled",
  "skipped",
]);
export const automationJobStatusEnum = pgEnum("automation_job_status", [
  "pending",
  "processing",
  "succeeded",
  "retry",
  "dead",
  "cancelled",
]);
export const automationSourceEnum = pgEnum("automation_source", [
  "manual",
  "integration",
  "import",
  "system",
  "automation",
]);
export const assignmentResourceEnum = pgEnum("assignment_resource", [
  "conversation",
  "opportunity",
  "both",
]);
export const assignmentStrategyEnum = pgEnum("assignment_strategy", [
  "round_robin",
  "least_open_workload",
  "fixed_fallback",
]);
export const availabilityStatusEnum = pgEnum("availability_status", [
  "available",
  "unavailable",
]);
export const calendarStatusEnum = pgEnum("calendar_status", [
  "draft",
  "active",
  "archived",
]);
export const slaResourceEnum = pgEnum("sla_resource", ["conversation", "opportunity"]);
export const slaStatusEnum = pgEnum("sla_status", [
  "active",
  "paused",
  "met",
  "breached",
  "cancelled",
]);
export const reminderStatusEnum = pgEnum("reminder_status", [
  "scheduled",
  "delivered",
  "cancelled",
  "failed",
  "superseded",
]);
export const notificationSeverityEnum = pgEnum("notification_severity", [
  "info",
  "warning",
  "critical",
]);

export const automationEvents = pgTable(
  "automation_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    occurredAt: instant("occurred_at").notNull(),
    source: automationSourceEnum("source").notNull(),
    actorMembershipId: text("actor_membership_id"),
    correlationId: text("correlation_id").notNull(),
    causationEventId: text("causation_event_id"),
    causationDepth: integer("causation_depth").default(0).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: automationJobStatusEnum("status").default("pending").notNull(),
    availableAt: instant("available_at").defaultNow().notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(8).notNull(),
    lockOwner: text("lock_owner"),
    leaseExpiresAt: instant("lease_expires_at"),
    errorCode: text("error_code"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("automation_events_tenant_id_unique").on(table.tenantId, table.id),
    uniqueIndex("automation_events_correlation_idx").on(table.correlationId),
    index("automation_events_claim_idx").on(table.status, table.availableAt),
    check(
      "automation_events_depth_check",
      sql`${table.causationDepth} between 0 and 5`,
    ),
    check("automation_events_schema_check", sql`${table.schemaVersion} > 0`),
  ],
);
export const automationRules = pgTable(
  "automation_rules",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    module: text("module").notNull(),
    status: automationRuleStatusEnum("status").default("draft").notNull(),
    priority: integer("priority").default(100).notNull(),
    stopProcessing: boolean("stop_processing").default(false).notNull(),
    activeVersionId: text("active_version_id"),
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
    uniqueIndex("automation_rules_name_idx")
      .on(table.tenantId, table.name)
      .where(sql`${table.status} <> 'archived'`),
    index("automation_rules_active_trigger_idx").on(
      table.tenantId,
      table.status,
      table.priority,
    ),
  ],
);
export const automationRuleVersions = pgTable(
  "automation_rule_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    ruleId: text("rule_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    triggerName: text("trigger_name").notNull(),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
    summary: text("summary").notNull(),
    definitionHash: text("definition_hash").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    publishedByUserId: text("published_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    publishedAt: instant("published_at").defaultNow().notNull(),
    retiredAt: instant("retired_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("automation_rule_versions_number_idx").on(
      table.tenantId,
      table.ruleId,
      table.versionNumber,
    ),
    uniqueIndex("automation_rule_versions_hash_idx").on(
      table.tenantId,
      table.ruleId,
      table.definitionHash,
    ),
    foreignKey({
      columns: [table.tenantId, table.ruleId],
      foreignColumns: [automationRules.tenantId, automationRules.id],
      name: "automation_rule_versions_rule_same_tenant_fk",
    }),
  ],
);
export const automationRuleRuns = pgTable(
  "automation_rule_runs",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    eventId: text("event_id").notNull(),
    ruleVersionId: text("rule_version_id").notNull(),
    status: automationRunStatusEnum("status").notNull(),
    evaluation: jsonb("evaluation").$type<Record<string, unknown>>().notNull(),
    correlationId: text("correlation_id").notNull(),
    causationDepth: integer("causation_depth").notNull(),
    actionCount: integer("action_count").default(0).notNull(),
    errorCode: text("error_code"),
    startedAt: instant("started_at").defaultNow().notNull(),
    finishedAt: instant("finished_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("automation_rule_runs_event_version_idx").on(
      table.tenantId,
      table.eventId,
      table.ruleVersionId,
    ),
    index("automation_rule_runs_rule_date_idx").on(
      table.tenantId,
      table.ruleVersionId,
      table.startedAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.eventId],
      foreignColumns: [automationEvents.tenantId, automationEvents.id],
      name: "automation_runs_event_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.ruleVersionId],
      foreignColumns: [automationRuleVersions.tenantId, automationRuleVersions.id],
      name: "automation_runs_version_same_tenant_fk",
    }),
  ],
);
export const automationActionRuns = pgTable(
  "automation_action_runs",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    ruleRunId: text("rule_run_id").notNull(),
    actionIndex: integer("action_index").notNull(),
    actionType: text("action_type").notNull(),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
    status: automationRunStatusEnum("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    resultResourceType: text("result_resource_type"),
    resultResourceId: text("result_resource_id"),
    attempts: integer("attempts").default(0).notNull(),
    errorCode: text("error_code"),
    startedAt: instant("started_at"),
    finishedAt: instant("finished_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("automation_action_runs_dedupe_idx").on(
      table.tenantId,
      table.ruleRunId,
      table.actionIndex,
    ),
    uniqueIndex("automation_action_runs_idempotency_idx").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.tenantId, table.ruleRunId],
      foreignColumns: [automationRuleRuns.tenantId, automationRuleRuns.id],
      name: "automation_action_runs_run_same_tenant_fk",
    }),
  ],
);
export const automationJobs = pgTable(
  "automation_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    type: text("type").notNull(),
    sourceId: text("source_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    status: automationJobStatusEnum("status").default("pending").notNull(),
    priority: integer("priority").default(0).notNull(),
    availableAt: instant("available_at").defaultNow().notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(8).notNull(),
    lockOwner: text("lock_owner"),
    lockedAt: instant("locked_at"),
    leaseExpiresAt: instant("lease_expires_at"),
    resourceGeneration: integer("resource_generation"),
    errorCode: text("error_code"),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("automation_jobs_idempotency_idx").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("automation_jobs_claim_idx").on(
      table.status,
      table.availableAt,
      table.priority,
    ),
  ],
);
export const assignmentQueues = pgTable(
  "assignment_queues",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    resource: assignmentResourceEnum("resource").notNull(),
    strategy: assignmentStrategyEnum("strategy").notNull(),
    active: boolean("active").default(true).notNull(),
    fallbackMembershipId: text("fallback_membership_id"),
    maxLoad: integer("max_load"),
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
    uniqueIndex("assignment_queues_name_idx").on(table.tenantId, table.name),
  ],
);
export const assignmentQueueMembers = pgTable(
  "assignment_queue_members",
  {
    tenantId: text("tenant_id").notNull(),
    queueId: text("queue_id").notNull(),
    membershipId: text("membership_id").notNull(),
    active: boolean("active").default(true).notNull(),
    weight: integer("weight").default(1).notNull(),
    priority: integer("priority").default(100).notNull(),
    maxLoad: integer("max_load"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.queueId, table.membershipId] }),
    foreignKey({
      columns: [table.tenantId, table.queueId],
      foreignColumns: [assignmentQueues.tenantId, assignmentQueues.id],
      name: "assignment_queue_members_queue_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "assignment_queue_members_member_same_tenant_fk",
    }),
  ],
);
export const assignmentQueueState = pgTable(
  "assignment_queue_state",
  {
    tenantId: text("tenant_id").notNull(),
    queueId: text("queue_id").notNull(),
    cursor: integer("cursor").default(0).notNull(),
    lastMembershipId: text("last_membership_id"),
    version: integer("version").default(1).notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.queueId] }),
    foreignKey({
      columns: [table.tenantId, table.queueId],
      foreignColumns: [assignmentQueues.tenantId, assignmentQueues.id],
      name: "assignment_queue_state_queue_same_tenant_fk",
    }),
  ],
);
export const memberWorkAvailability = pgTable(
  "member_work_availability",
  {
    tenantId: text("tenant_id").notNull(),
    membershipId: text("membership_id").notNull(),
    status: availabilityStatusEnum("status").default("available").notNull(),
    unavailableUntil: instant("unavailable_until"),
    reason: text("reason"),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    version: integer("version").default(1).notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.membershipId] }),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "member_availability_member_same_tenant_fk",
    }),
  ],
);
export const businessCalendars = pgTable(
  "business_calendars",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    status: calendarStatusEnum("status").default("draft").notNull(),
    activeVersionId: text("active_version_id"),
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
    uniqueIndex("business_calendars_name_idx").on(table.tenantId, table.name),
  ],
);
export const businessCalendarVersions = pgTable(
  "business_calendar_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    calendarId: text("calendar_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    publishedAt: instant("published_at"),
    publishedByUserId: text("published_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("business_calendar_versions_number_idx").on(
      table.tenantId,
      table.calendarId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.tenantId, table.calendarId],
      foreignColumns: [businessCalendars.tenantId, businessCalendars.id],
      name: "business_calendar_versions_calendar_same_tenant_fk",
    }),
  ],
);
export const businessCalendarIntervals = pgTable(
  "business_calendar_intervals",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    calendarVersionId: text("calendar_version_id").notNull(),
    isoDay: integer("iso_day").notNull(),
    startLocal: time("start_local").notNull(),
    endLocal: time("end_local").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.calendarVersionId],
      foreignColumns: [businessCalendarVersions.tenantId, businessCalendarVersions.id],
      name: "business_calendar_intervals_version_same_tenant_fk",
    }),
    check(
      "business_calendar_intervals_day_check",
      sql`${table.isoDay} between 1 and 7`,
    ),
    check(
      "business_calendar_intervals_order_check",
      sql`${table.startLocal} < ${table.endLocal}`,
    ),
  ],
);
export const businessCalendarExceptions = pgTable(
  "business_calendar_exceptions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    calendarVersionId: text("calendar_version_id").notNull(),
    localDate: text("local_date").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("business_calendar_exceptions_date_idx").on(
      table.tenantId,
      table.calendarVersionId,
      table.localDate,
    ),
    foreignKey({
      columns: [table.tenantId, table.calendarVersionId],
      foreignColumns: [businessCalendarVersions.tenantId, businessCalendarVersions.id],
      name: "business_calendar_exceptions_version_same_tenant_fk",
    }),
  ],
);
export const slaPolicies = pgTable(
  "sla_policies",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    resource: slaResourceEnum("resource").notNull(),
    status: automationRuleStatusEnum("status").default("draft").notNull(),
    activeVersionId: text("active_version_id"),
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
    uniqueIndex("sla_policies_name_idx").on(table.tenantId, table.name),
  ],
);
export const slaPolicyVersions = pgTable(
  "sla_policy_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    policyId: text("policy_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    objective: text("objective").notNull(),
    targetBusinessMinutes: integer("target_business_minutes").notNull(),
    calendarVersionId: text("calendar_version_id").notNull(),
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
    hash: text("hash").notNull(),
    publishedAt: instant("published_at"),
    publishedByUserId: text("published_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("sla_policy_versions_number_idx").on(
      table.tenantId,
      table.policyId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.tenantId, table.policyId],
      foreignColumns: [slaPolicies.tenantId, slaPolicies.id],
      name: "sla_policy_versions_policy_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.calendarVersionId],
      foreignColumns: [businessCalendarVersions.tenantId, businessCalendarVersions.id],
      name: "sla_policy_versions_calendar_same_tenant_fk",
    }),
    check("sla_policy_versions_target_check", sql`${table.targetBusinessMinutes} > 0`),
  ],
);
export const slaInstances = pgTable(
  "sla_instances",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    policyId: text("policy_id").notNull(),
    policyVersionId: text("policy_version_id").notNull(),
    resource: slaResourceEnum("resource").notNull(),
    resourceId: text("resource_id").notNull(),
    status: slaStatusEnum("status").default("active").notNull(),
    startedAt: instant("started_at").notNull(),
    dueAt: instant("due_at").notNull(),
    targetBusinessMinutes: integer("target_business_minutes").notNull(),
    calendarVersionId: text("calendar_version_id").notNull(),
    generation: integer("generation").default(1).notNull(),
    metAt: instant("met_at"),
    breachedAt: instant("breached_at"),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("sla_instances_resource_active_idx")
      .on(table.tenantId, table.resource, table.resourceId, table.policyId)
      .where(sql`${table.status} in ('active','paused')`),
    index("sla_instances_due_idx").on(table.tenantId, table.status, table.dueAt),
    foreignKey({
      columns: [table.tenantId, table.policyId],
      foreignColumns: [slaPolicies.tenantId, slaPolicies.id],
      name: "sla_instances_policy_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.policyVersionId],
      foreignColumns: [slaPolicyVersions.tenantId, slaPolicyVersions.id],
      name: "sla_instances_policy_version_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.calendarVersionId],
      foreignColumns: [businessCalendarVersions.tenantId, businessCalendarVersions.id],
      name: "sla_instances_calendar_same_tenant_fk",
    }),
    check(
      "sla_instances_terminal_fields_check",
      sql`(${table.status} not in ('met','breached') or ${table.metAt} is not null or ${table.breachedAt} is not null)`,
    ),
  ],
);
export const slaInstanceEvents = pgTable(
  "sla_instance_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    instanceId: text("instance_id").notNull(),
    type: text("type").notNull(),
    occurredAt: instant("occurred_at").notNull(),
    source: automationSourceEnum("source").notNull(),
    generation: integer("generation").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => [
    uniqueIndex("sla_instance_events_dedupe_idx").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    foreignKey({
      columns: [table.tenantId, table.instanceId],
      foreignColumns: [slaInstances.tenantId, slaInstances.id],
      name: "sla_instance_events_instance_same_tenant_fk",
    }),
  ],
);
export const resourceReminders = pgTable(
  "resource_reminders",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    membershipId: text("membership_id").notNull(),
    source: automationSourceEnum("source").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    remindAt: instant("remind_at").notNull(),
    timezone: text("timezone").notNull(),
    channel: text("channel").notNull(),
    status: reminderStatusEnum("status").default("scheduled").notNull(),
    generation: integer("generation").default(1).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("resource_reminders_idempotency_idx").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("resource_reminders_due_idx").on(
      table.tenantId,
      table.status,
      table.remindAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "resource_reminders_member_same_tenant_fk",
    }),
  ],
);
export const internalNotifications = pgTable(
  "internal_notifications",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    membershipId: text("membership_id").notNull(),
    type: text("type").notNull(),
    severity: notificationSeverityEnum("severity").notNull(),
    title: text("title").notNull(),
    bodyText: text("body_text").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    readAt: instant("read_at"),
    archivedAt: instant("archived_at"),
    expiresAt: instant("expires_at"),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("internal_notifications_dedupe_idx").on(
      table.tenantId,
      table.membershipId,
      table.dedupeKey,
    ),
    index("internal_notifications_unread_idx").on(
      table.tenantId,
      table.membershipId,
      table.readAt,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "internal_notifications_member_same_tenant_fk",
    }),
  ],
);
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    tenantId: text("tenant_id").notNull(),
    membershipId: text("membership_id").notNull(),
    emailEnabled: boolean("email_enabled").default(false).notNull(),
    quietHours: jsonb("quiet_hours").$type<{ start?: string; end?: string } | null>(),
    timezone: text("timezone").notNull(),
    version: integer("version").default(1).notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.membershipId] }),
    foreignKey({
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "notification_preferences_member_same_tenant_fk",
    }),
  ],
);
