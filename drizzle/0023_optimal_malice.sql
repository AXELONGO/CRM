CREATE TYPE "public"."project_approval_status" AS ENUM('pending', 'approved', 'rejected', 'stale', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."project_gate_status" AS ENUM('pending', 'satisfied', 'failed', 'unavailable', 'stale');--> statement-breakpoint
CREATE TYPE "public"."project_health" AS ENUM('not_set', 'on_track', 'at_risk', 'off_track');--> statement-breakpoint
CREATE TYPE "public"."project_preparation_status" AS ENUM('awaiting_template', 'awaiting_commercial_scope', 'ready_for_planning', 'planning', 'activation_pending');--> statement-breakpoint
CREATE TYPE "public"."project_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'activation_pending', 'active', 'on_hold', 'completed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_task_status" AS ENUM('todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."project_template_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TABLE "project_activation_approvals" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"plan_version_id" text NOT NULL,
	"plan_hash" text NOT NULL,
	"requested_by_membership_id" text NOT NULL,
	"status" "project_approval_status" DEFAULT 'pending' NOT NULL,
	"decided_by_membership_id" text,
	"decision_reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "project_activation_approvals_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_activation_policies" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"require_accepted_quote" boolean DEFAULT true NOT NULL,
	"require_satisfied_deposit" boolean DEFAULT true NOT NULL,
	"require_internal_approval" boolean DEFAULT true NOT NULL,
	"require_executed_agreement" boolean DEFAULT true NOT NULL,
	"status" "project_template_status" DEFAULT 'published' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_activation_policies_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_activations" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"plan_version_id" text NOT NULL,
	"project_number" text NOT NULL,
	"gate_evidence" jsonb NOT NULL,
	"activated_by_membership_id" text NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evidence_digest" text NOT NULL,
	CONSTRAINT "project_activations_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_number_sequences" (
	"tenant_id" text NOT NULL,
	"year" integer NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "project_number_sequences_tenant_id_year_pk" PRIMARY KEY("tenant_id","year")
);
--> statement-breakpoint
CREATE TABLE "project_outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_phases" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"template_key" text,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"planned_start_date" text,
	"planned_end_date" text,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "project_phases_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_plan_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"template_version_id" text NOT NULL,
	"commercial_origin_snapshot" jsonb NOT NULL,
	"project_snapshot" jsonb NOT NULL,
	"phases" jsonb NOT NULL,
	"tasks" jsonb NOT NULL,
	"activation_policy_snapshot" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_plan_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_task_checklist_items" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"task_id" text NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "project_task_checklist_items_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_task_dependencies" (
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"predecessor_task_id" text NOT NULL,
	"successor_task_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_task_dependencies_tenant_id_predecessor_task_id_successor_task_id_pk" PRIMARY KEY("tenant_id","predecessor_task_id","successor_task_id"),
	CONSTRAINT "project_dependency_no_self_check" CHECK ("project_task_dependencies"."predecessor_task_id" <> "project_task_dependencies"."successor_task_id")
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"project_id" text NOT NULL,
	"phase_id" text NOT NULL,
	"template_key" text,
	"title" text NOT NULL,
	"description" text,
	"status" "project_task_status" DEFAULT 'todo' NOT NULL,
	"priority" "project_priority" DEFAULT 'normal' NOT NULL,
	"assignee_membership_id" text,
	"due_date" text,
	"position" bigint DEFAULT 1024 NOT NULL,
	"blocked_reason" text,
	"review_required" boolean DEFAULT false NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_tasks_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_template_selection_rules" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"priority" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"commercial_model" text,
	"template_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_template_selection_rules_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_template_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"template_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_membership_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_template_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"commercial_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "project_template_status" DEFAULT 'draft' NOT NULL,
	"activation_policy_id" text NOT NULL,
	"current_published_version_id" text,
	"created_by_membership_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_templates_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"quote_id" text,
	"quote_version_id" text,
	"accepted_scope_hash" text,
	"customer_account_id" text,
	"primary_contact_id" text,
	"origin_owner_membership_id" text NOT NULL,
	"project_manager_membership_id" text,
	"template_version_id" text,
	"current_plan_version_id" text,
	"activation_policy_version_id" text,
	"number" text,
	"name" text NOT NULL,
	"summary" text,
	"commercial_model" text NOT NULL,
	"currency" text NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"preparation_status" "project_preparation_status" DEFAULT 'awaiting_template' NOT NULL,
	"health" "project_health" DEFAULT 'not_set' NOT NULL,
	"health_note" text,
	"expected_start_date" text,
	"actual_start_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_membership_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "projects_currency_check" CHECK ("projects"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "project_activation_approvals" ADD CONSTRAINT "project_approval_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activation_approvals" ADD CONSTRAINT "project_approval_plan_same_tenant_fk" FOREIGN KEY ("tenant_id","plan_version_id") REFERENCES "public"."project_plan_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activation_approvals" ADD CONSTRAINT "project_approval_requester_same_tenant_fk" FOREIGN KEY ("tenant_id","requested_by_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activations" ADD CONSTRAINT "project_activation_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phase_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_plan_versions" ADD CONSTRAINT "project_plan_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_plan_versions" ADD CONSTRAINT "project_plan_template_same_tenant_fk" FOREIGN KEY ("tenant_id","template_version_id") REFERENCES "public"."project_template_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task_checklist_items" ADD CONSTRAINT "project_checklist_task_same_tenant_fk" FOREIGN KEY ("tenant_id","task_id") REFERENCES "public"."project_tasks"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_dependency_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_task_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_task_phase_same_tenant_fk" FOREIGN KEY ("tenant_id","phase_id") REFERENCES "public"."project_phases"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_selection_rules" ADD CONSTRAINT "project_template_rule_template_same_tenant_fk" FOREIGN KEY ("tenant_id","template_id") REFERENCES "public"."project_templates"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_versions" ADD CONSTRAINT "project_template_version_template_same_tenant_fk" FOREIGN KEY ("tenant_id","template_id") REFERENCES "public"."project_templates"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_template_policy_same_tenant_fk" FOREIGN KEY ("tenant_id","activation_policy_id") REFERENCES "public"."project_activation_policies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_templates" ADD CONSTRAINT "project_template_creator_same_tenant_fk" FOREIGN KEY ("tenant_id","created_by_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_opportunity_same_tenant_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."sales_opportunities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_quote_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_id") REFERENCES "public"."quotes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_quote_version_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_version_id") REFERENCES "public"."quote_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_account_same_tenant_fk" FOREIGN KEY ("tenant_id","customer_account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","primary_contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","origin_owner_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_activation_approval_plan_unique" ON "project_activation_approvals" USING btree ("tenant_id","plan_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_activation_policy_name_unique" ON "project_activation_policies" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "project_activation_project_unique" ON "project_activations" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "project_outbox_tenant_created_idx" ON "project_outbox_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "project_phase_board_idx" ON "project_phases" USING btree ("tenant_id","project_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "project_plan_version_unique" ON "project_plan_versions" USING btree ("tenant_id","project_id","version_number");--> statement-breakpoint
CREATE INDEX "project_task_board_idx" ON "project_tasks" USING btree ("tenant_id","project_id","status","position");--> statement-breakpoint
CREATE INDEX "project_template_rule_priority_idx" ON "project_template_selection_rules" USING btree ("tenant_id","enabled","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "project_template_version_unique" ON "project_template_versions" USING btree ("tenant_id","template_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "project_template_name_unique" ON "project_templates" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_opportunity_unique" ON "projects" USING btree ("tenant_id","opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_number_unique" ON "projects" USING btree ("tenant_id","number");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project_activation_approvals", "project_activation_policies", "project_activations", "project_number_sequences", "project_outbox_events", "project_phases", "project_plan_versions", "project_task_checklist_items", "project_task_dependencies", "project_tasks", "project_template_selection_rules", "project_template_versions", "project_templates", "projects" TO crm_runtime, crm_worker;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'project_activation_approvals', 'project_activation_policies', 'project_activations',
    'project_number_sequences', 'project_outbox_events', 'project_phases',
    'project_plan_versions', 'project_task_checklist_items', 'project_task_dependencies',
    'project_tasks', 'project_template_selection_rules', 'project_template_versions',
    'project_templates', 'projects'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END $$;
