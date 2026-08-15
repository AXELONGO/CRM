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
import { commercialAccounts, commercialContacts } from "./commercial-directory";
import { salesOpportunities } from "./sales";
import { quoteVersions, quotes } from "./quotes";
import { tenantMemberships, tenants } from "./tenancy";

const instant = (name: string) => timestamp(name, { withTimezone: true });
export const projectTemplateStatusEnum = pgEnum("project_template_status", [
  "draft",
  "published",
  "retired",
]);
export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "activation_pending",
  "active",
  "on_hold",
  "completed",
  "cancelled",
  "archived",
]);
export const projectPreparationStatusEnum = pgEnum("project_preparation_status", [
  "awaiting_template",
  "awaiting_commercial_scope",
  "ready_for_planning",
  "planning",
  "activation_pending",
]);
export const projectHealthEnum = pgEnum("project_health", [
  "not_set",
  "on_track",
  "at_risk",
  "off_track",
]);
export const projectTaskStatusEnum = pgEnum("project_task_status", [
  "todo",
  "in_progress",
  "review",
  "blocked",
  "done",
  "cancelled",
]);
export const projectPriorityEnum = pgEnum("project_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);
export const projectApprovalStatusEnum = pgEnum("project_approval_status", [
  "pending",
  "approved",
  "rejected",
  "stale",
  "cancelled",
]);
export const projectGateStatusEnum = pgEnum("project_gate_status", [
  "pending",
  "satisfied",
  "failed",
  "unavailable",
  "stale",
]);

export const projectActivationPolicies = pgTable(
  "project_activation_policies",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    requireAcceptedQuote: boolean("require_accepted_quote").default(true).notNull(),
    requireSatisfiedDeposit: boolean("require_satisfied_deposit")
      .default(true)
      .notNull(),
    requireInternalApproval: boolean("require_internal_approval")
      .default(true)
      .notNull(),
    requireExecutedAgreement: boolean("require_executed_agreement")
      .default(true)
      .notNull(),
    status: projectTemplateStatusEnum("status").default("published").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("project_activation_policy_name_unique").on(table.tenantId, table.name),
  ],
);

export const projectTemplates = pgTable(
  "project_templates",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    commercialModels: jsonb("commercial_models")
      .$type<string[]>()
      .notNull()
      .default([]),
    status: projectTemplateStatusEnum("status").default("draft").notNull(),
    activationPolicyId: text("activation_policy_id").notNull(),
    currentPublishedVersionId: text("current_published_version_id"),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("project_template_name_unique").on(table.tenantId, table.name),
    foreignKey({
      columns: [table.tenantId, table.activationPolicyId],
      foreignColumns: [
        projectActivationPolicies.tenantId,
        projectActivationPolicies.id,
      ],
      name: "project_template_policy_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.createdByMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "project_template_creator_same_tenant_fk",
    }),
  ],
);

export const projectTemplateVersions = pgTable(
  "project_template_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    templateId: text("template_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    contentHash: text("content_hash").notNull(),
    publishedAt: instant("published_at"),
    publishedByMembershipId: text("published_by_membership_id"),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("project_template_version_unique").on(
      table.tenantId,
      table.templateId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.tenantId, table.templateId],
      foreignColumns: [projectTemplates.tenantId, projectTemplates.id],
      name: "project_template_version_template_same_tenant_fk",
    }),
  ],
);

export const projectTemplateSelectionRules = pgTable(
  "project_template_selection_rules",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    priority: integer("priority").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    commercialModel: text("commercial_model"),
    templateId: text("template_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.templateId],
      foreignColumns: [projectTemplates.tenantId, projectTemplates.id],
      name: "project_template_rule_template_same_tenant_fk",
    }),
    index("project_template_rule_priority_idx").on(
      table.tenantId,
      table.enabled,
      table.priority,
    ),
  ],
);

export const projectNumberSequences = pgTable(
  "project_number_sequences",
  {
    tenantId: text("tenant_id").notNull(),
    year: integer("year").notNull(),
    nextValue: integer("next_value").default(1).notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.year] })],
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    quoteId: text("quote_id"),
    quoteVersionId: text("quote_version_id"),
    acceptedScopeHash: text("accepted_scope_hash"),
    customerAccountId: text("customer_account_id"),
    primaryContactId: text("primary_contact_id"),
    originOwnerMembershipId: text("origin_owner_membership_id").notNull(),
    projectManagerMembershipId: text("project_manager_membership_id"),
    templateVersionId: text("template_version_id"),
    currentPlanVersionId: text("current_plan_version_id"),
    activationPolicyVersionId: text("activation_policy_version_id"),
    number: text("number"),
    name: text("name").notNull(),
    summary: text("summary"),
    commercialModel: text("commercial_model").notNull(),
    currency: text("currency").notNull(),
    status: projectStatusEnum("status").default("draft").notNull(),
    preparationStatus: projectPreparationStatusEnum("preparation_status")
      .default("awaiting_template")
      .notNull(),
    health: projectHealthEnum("health").default("not_set").notNull(),
    healthNote: text("health_note"),
    expectedStartDate: text("expected_start_date"),
    actualStartAt: instant("actual_start_at"),
    completedAt: instant("completed_at"),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("projects_opportunity_unique").on(table.tenantId, table.opportunityId),
    uniqueIndex("projects_number_unique").on(table.tenantId, table.number),
    foreignKey({
      columns: [table.tenantId, table.opportunityId],
      foreignColumns: [salesOpportunities.tenantId, salesOpportunities.id],
      name: "projects_opportunity_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.quoteId],
      foreignColumns: [quotes.tenantId, quotes.id],
      name: "projects_quote_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.quoteVersionId],
      foreignColumns: [quoteVersions.tenantId, quoteVersions.id],
      name: "projects_quote_version_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.customerAccountId],
      foreignColumns: [commercialAccounts.tenantId, commercialAccounts.id],
      name: "projects_account_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.primaryContactId],
      foreignColumns: [commercialContacts.tenantId, commercialContacts.id],
      name: "projects_contact_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.originOwnerMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "projects_owner_same_tenant_fk",
    }),
    check("projects_currency_check", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);

export const projectPlanVersions = pgTable(
  "project_plan_versions",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    templateVersionId: text("template_version_id").notNull(),
    commercialOriginSnapshot: jsonb("commercial_origin_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    projectSnapshot: jsonb("project_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    phases: jsonb("phases").$type<unknown[]>().notNull(),
    tasks: jsonb("tasks").$type<unknown[]>().notNull(),
    activationPolicySnapshot: jsonb("activation_policy_snapshot")
      .$type<Record<string, unknown>>()
      .notNull(),
    contentHash: text("content_hash").notNull(),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("project_plan_version_unique").on(
      table.tenantId,
      table.projectId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "project_plan_project_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.templateVersionId],
      foreignColumns: [projectTemplateVersions.tenantId, projectTemplateVersions.id],
      name: "project_plan_template_same_tenant_fk",
    }),
  ],
);

export const projectActivationApprovals = pgTable(
  "project_activation_approvals",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    planVersionId: text("plan_version_id").notNull(),
    planHash: text("plan_hash").notNull(),
    requestedByMembershipId: text("requested_by_membership_id").notNull(),
    status: projectApprovalStatusEnum("status").default("pending").notNull(),
    decidedByMembershipId: text("decided_by_membership_id"),
    decisionReason: text("decision_reason"),
    requestedAt: instant("requested_at").defaultNow().notNull(),
    decidedAt: instant("decided_at"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("project_activation_approval_plan_unique").on(
      table.tenantId,
      table.planVersionId,
    ),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "project_approval_project_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.planVersionId],
      foreignColumns: [projectPlanVersions.tenantId, projectPlanVersions.id],
      name: "project_approval_plan_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.requestedByMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: "project_approval_requester_same_tenant_fk",
    }),
  ],
);

export const projectActivations = pgTable(
  "project_activations",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    planVersionId: text("plan_version_id").notNull(),
    projectNumber: text("project_number").notNull(),
    gateEvidence: jsonb("gate_evidence").$type<Record<string, unknown>>().notNull(),
    activatedByMembershipId: text("activated_by_membership_id").notNull(),
    activatedAt: instant("activated_at").defaultNow().notNull(),
    evidenceDigest: text("evidence_digest").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    uniqueIndex("project_activation_project_unique").on(
      table.tenantId,
      table.projectId,
    ),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "project_activation_project_same_tenant_fk",
    }),
  ],
);

export const projectPhases = pgTable(
  "project_phases",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    templateKey: text("template_key"),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    status: text("status").default("not_started").notNull(),
    plannedStartDate: text("planned_start_date"),
    plannedEndDate: text("planned_end_date"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "project_phase_project_same_tenant_fk",
    }),
    index("project_phase_board_idx").on(
      table.tenantId,
      table.projectId,
      table.position,
    ),
  ],
);
export const projectTasks = pgTable(
  "project_tasks",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    phaseId: text("phase_id").notNull(),
    templateKey: text("template_key"),
    title: text("title").notNull(),
    description: text("description"),
    status: projectTaskStatusEnum("status").default("todo").notNull(),
    priority: projectPriorityEnum("priority").default("normal").notNull(),
    assigneeMembershipId: text("assignee_membership_id"),
    dueDate: text("due_date"),
    position: bigint("position", { mode: "bigint" })
      .default(sql`1024`)
      .notNull(),
    blockedReason: text("blocked_reason"),
    reviewRequired: boolean("review_required").default(false).notNull(),
    createdByMembershipId: text("created_by_membership_id").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
    updatedAt: instant("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "project_task_project_same_tenant_fk",
    }),
    foreignKey({
      columns: [table.tenantId, table.phaseId],
      foreignColumns: [projectPhases.tenantId, projectPhases.id],
      name: "project_task_phase_same_tenant_fk",
    }),
    index("project_task_board_idx").on(
      table.tenantId,
      table.projectId,
      table.status,
      table.position,
    ),
  ],
);
export const projectTaskChecklistItems = pgTable(
  "project_task_checklist_items",
  {
    id: text("id").notNull(),
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    taskId: text("task_id").notNull(),
    text: text("text").notNull(),
    position: integer("position").notNull(),
    required: boolean("required").default(true).notNull(),
    completed: boolean("completed").default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id] }),
    foreignKey({
      columns: [table.tenantId, table.taskId],
      foreignColumns: [projectTasks.tenantId, projectTasks.id],
      name: "project_checklist_task_same_tenant_fk",
    }),
  ],
);
export const projectTaskDependencies = pgTable(
  "project_task_dependencies",
  {
    tenantId: text("tenant_id").notNull(),
    projectId: text("project_id").notNull(),
    predecessorTaskId: text("predecessor_task_id").notNull(),
    successorTaskId: text("successor_task_id").notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.predecessorTaskId, table.successorTaskId],
    }),
    foreignKey({
      columns: [table.tenantId, table.projectId],
      foreignColumns: [projects.tenantId, projects.id],
      name: "project_dependency_project_same_tenant_fk",
    }),
    check(
      "project_dependency_no_self_check",
      sql`${table.predecessorTaskId} <> ${table.successorTaskId}`,
    ),
  ],
);
export const projectOutboxEvents = pgTable(
  "project_outbox_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: instant("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_outbox_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);
