CREATE TYPE "public"."assignment_resource" AS ENUM('conversation', 'opportunity', 'both');--> statement-breakpoint
CREATE TYPE "public"."assignment_strategy" AS ENUM('round_robin', 'least_open_workload', 'fixed_fallback');--> statement-breakpoint
CREATE TYPE "public"."automation_job_status" AS ENUM('pending', 'processing', 'succeeded', 'retry', 'dead', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."automation_rule_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."automation_run_status" AS ENUM('matched', 'not_matched', 'running', 'succeeded', 'partial', 'failed', 'cancelled', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."automation_source" AS ENUM('manual', 'integration', 'import', 'system', 'automation');--> statement-breakpoint
CREATE TYPE "public"."availability_status" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."calendar_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('scheduled', 'delivered', 'cancelled', 'failed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."sla_resource" AS ENUM('conversation', 'opportunity');--> statement-breakpoint
CREATE TYPE "public"."sla_status" AS ENUM('active', 'paused', 'met', 'breached', 'cancelled');--> statement-breakpoint
CREATE TABLE "assignment_queue_members" (
	"tenant_id" text NOT NULL,
	"queue_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"max_load" integer,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_queue_members_tenant_id_queue_id_membership_id_pk" PRIMARY KEY("tenant_id","queue_id","membership_id")
);
--> statement-breakpoint
CREATE TABLE "assignment_queue_state" (
	"tenant_id" text NOT NULL,
	"queue_id" text NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"last_membership_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_queue_state_tenant_id_queue_id_pk" PRIMARY KEY("tenant_id","queue_id")
);
--> statement-breakpoint
CREATE TABLE "assignment_queues" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"resource" "assignment_resource" NOT NULL,
	"strategy" "assignment_strategy" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"fallback_membership_id" text,
	"max_load" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_queues_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "automation_action_runs" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"rule_run_id" text NOT NULL,
	"action_index" integer NOT NULL,
	"action_type" text NOT NULL,
	"definition" jsonb NOT NULL,
	"status" "automation_run_status" NOT NULL,
	"idempotency_key" text NOT NULL,
	"result_resource_type" text,
	"result_resource_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "automation_action_runs_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "automation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"schema_version" integer NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" "automation_source" NOT NULL,
	"actor_membership_id" text,
	"correlation_id" text NOT NULL,
	"causation_event_id" text,
	"causation_depth" integer DEFAULT 0 NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "automation_job_status" DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"lock_owner" text,
	"lease_expires_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_events_depth_check" CHECK ("automation_events"."causation_depth" between 0 and 5),
	CONSTRAINT "automation_events_schema_check" CHECK ("automation_events"."schema_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "automation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"type" text NOT NULL,
	"source_id" text,
	"idempotency_key" text NOT NULL,
	"status" "automation_job_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"lock_owner" text,
	"locked_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"resource_generation" integer,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rule_runs" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" text NOT NULL,
	"rule_version_id" text NOT NULL,
	"status" "automation_run_status" NOT NULL,
	"evaluation" jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"causation_depth" integer NOT NULL,
	"action_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "automation_rule_runs_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "automation_rule_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"trigger_name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"summary" text NOT NULL,
	"definition_hash" text NOT NULL,
	"schema_version" integer NOT NULL,
	"published_by_user_id" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "automation_rule_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"module" text NOT NULL,
	"status" "automation_rule_status" DEFAULT 'draft' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"stop_processing" boolean DEFAULT false NOT NULL,
	"active_version_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_rules_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "business_calendar_exceptions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"calendar_version_id" text NOT NULL,
	"local_date" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "business_calendar_exceptions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "business_calendar_intervals" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"calendar_version_id" text NOT NULL,
	"iso_day" integer NOT NULL,
	"start_local" time NOT NULL,
	"end_local" time NOT NULL,
	CONSTRAINT "business_calendar_intervals_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "business_calendar_intervals_day_check" CHECK ("business_calendar_intervals"."iso_day" between 1 and 7),
	CONSTRAINT "business_calendar_intervals_order_check" CHECK ("business_calendar_intervals"."start_local" < "business_calendar_intervals"."end_local")
);
--> statement-breakpoint
CREATE TABLE "business_calendar_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"calendar_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_calendar_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "business_calendars" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"status" "calendar_status" DEFAULT 'draft' NOT NULL,
	"active_version_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_calendars_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "internal_notifications" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"type" text NOT NULL,
	"severity" "notification_severity" NOT NULL,
	"title" text NOT NULL,
	"body_text" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "internal_notifications_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "member_work_availability" (
	"tenant_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"status" "availability_status" DEFAULT 'available' NOT NULL,
	"unavailable_until" timestamp with time zone,
	"reason" text,
	"updated_by_user_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_work_availability_tenant_id_membership_id_pk" PRIMARY KEY("tenant_id","membership_id")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"tenant_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"email_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours" jsonb,
	"timezone" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_tenant_id_membership_id_pk" PRIMARY KEY("tenant_id","membership_id")
);
--> statement-breakpoint
CREATE TABLE "resource_reminders" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"source" "automation_source" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"remind_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"channel" text NOT NULL,
	"status" "reminder_status" DEFAULT 'scheduled' NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_reminders_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "sla_instance_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"instance_id" text NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source" "automation_source" NOT NULL,
	"generation" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_instances" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"policy_version_id" text NOT NULL,
	"resource" "sla_resource" NOT NULL,
	"resource_id" text NOT NULL,
	"status" "sla_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"target_business_minutes" integer NOT NULL,
	"calendar_version_id" text NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"met_at" timestamp with time zone,
	"breached_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sla_instances_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "sla_instances_terminal_fields_check" CHECK (("sla_instances"."status" not in ('met','breached') or "sla_instances"."met_at" is not null or "sla_instances"."breached_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"resource" "sla_resource" NOT NULL,
	"status" "automation_rule_status" DEFAULT 'draft' NOT NULL,
	"active_version_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sla_policies_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "sla_policy_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"objective" text NOT NULL,
	"target_business_minutes" integer NOT NULL,
	"calendar_version_id" text NOT NULL,
	"definition" jsonb NOT NULL,
	"hash" text NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_user_id" text,
	CONSTRAINT "sla_policy_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "sla_policy_versions_target_check" CHECK ("sla_policy_versions"."target_business_minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "assignment_queue_members" ADD CONSTRAINT "assignment_queue_members_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_queue_members" ADD CONSTRAINT "assignment_queue_members_queue_same_tenant_fk" FOREIGN KEY ("tenant_id","queue_id") REFERENCES "public"."assignment_queues"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_queue_members" ADD CONSTRAINT "assignment_queue_members_member_same_tenant_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_queue_state" ADD CONSTRAINT "assignment_queue_state_queue_same_tenant_fk" FOREIGN KEY ("tenant_id","queue_id") REFERENCES "public"."assignment_queues"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_queues" ADD CONSTRAINT "assignment_queues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_queues" ADD CONSTRAINT "assignment_queues_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_queues" ADD CONSTRAINT "assignment_queues_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_action_runs" ADD CONSTRAINT "automation_action_runs_run_same_tenant_fk" FOREIGN KEY ("tenant_id","rule_run_id") REFERENCES "public"."automation_rule_runs"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_events_tenant_id_unique" ON "automation_events" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "automation_events" ADD CONSTRAINT "automation_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_runs" ADD CONSTRAINT "automation_runs_event_same_tenant_fk" FOREIGN KEY ("tenant_id","event_id") REFERENCES "public"."automation_events"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_runs" ADD CONSTRAINT "automation_runs_version_same_tenant_fk" FOREIGN KEY ("tenant_id","rule_version_id") REFERENCES "public"."automation_rule_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_versions" ADD CONSTRAINT "automation_rule_versions_published_by_user_id_user_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_versions" ADD CONSTRAINT "automation_rule_versions_rule_same_tenant_fk" FOREIGN KEY ("tenant_id","rule_id") REFERENCES "public"."automation_rules"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_calendar_exceptions" ADD CONSTRAINT "business_calendar_exceptions_version_same_tenant_fk" FOREIGN KEY ("tenant_id","calendar_version_id") REFERENCES "public"."business_calendar_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_calendar_intervals" ADD CONSTRAINT "business_calendar_intervals_version_same_tenant_fk" FOREIGN KEY ("tenant_id","calendar_version_id") REFERENCES "public"."business_calendar_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_published_by_user_id_user_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_calendar_same_tenant_fk" FOREIGN KEY ("tenant_id","calendar_id") REFERENCES "public"."business_calendars"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notifications" ADD CONSTRAINT "internal_notifications_member_same_tenant_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_work_availability" ADD CONSTRAINT "member_work_availability_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_work_availability" ADD CONSTRAINT "member_availability_member_same_tenant_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_member_same_tenant_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_reminders" ADD CONSTRAINT "resource_reminders_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_reminders" ADD CONSTRAINT "resource_reminders_member_same_tenant_fk" FOREIGN KEY ("tenant_id","membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_instance_events" ADD CONSTRAINT "sla_instance_events_instance_same_tenant_fk" FOREIGN KEY ("tenant_id","instance_id") REFERENCES "public"."sla_instances"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_policy_same_tenant_fk" FOREIGN KEY ("tenant_id","policy_id") REFERENCES "public"."sla_policies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_policy_version_same_tenant_fk" FOREIGN KEY ("tenant_id","policy_version_id") REFERENCES "public"."sla_policy_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_calendar_same_tenant_fk" FOREIGN KEY ("tenant_id","calendar_version_id") REFERENCES "public"."business_calendar_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policy_versions" ADD CONSTRAINT "sla_policy_versions_published_by_user_id_user_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policy_versions" ADD CONSTRAINT "sla_policy_versions_policy_same_tenant_fk" FOREIGN KEY ("tenant_id","policy_id") REFERENCES "public"."sla_policies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policy_versions" ADD CONSTRAINT "sla_policy_versions_calendar_same_tenant_fk" FOREIGN KEY ("tenant_id","calendar_version_id") REFERENCES "public"."business_calendar_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_queues_name_idx" ON "assignment_queues" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_action_runs_dedupe_idx" ON "automation_action_runs" USING btree ("tenant_id","rule_run_id","action_index");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_action_runs_idempotency_idx" ON "automation_action_runs" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_events_correlation_idx" ON "automation_events" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "automation_events_claim_idx" ON "automation_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_jobs_idempotency_idx" ON "automation_jobs" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "automation_jobs_claim_idx" ON "automation_jobs" USING btree ("status","available_at","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_rule_runs_event_version_idx" ON "automation_rule_runs" USING btree ("tenant_id","event_id","rule_version_id");--> statement-breakpoint
CREATE INDEX "automation_rule_runs_rule_date_idx" ON "automation_rule_runs" USING btree ("tenant_id","rule_version_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_rule_versions_number_idx" ON "automation_rule_versions" USING btree ("tenant_id","rule_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_rule_versions_hash_idx" ON "automation_rule_versions" USING btree ("tenant_id","rule_id","definition_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_rules_name_idx" ON "automation_rules" USING btree ("tenant_id","name") WHERE "automation_rules"."status" <> 'archived';--> statement-breakpoint
CREATE INDEX "automation_rules_active_trigger_idx" ON "automation_rules" USING btree ("tenant_id","status","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "business_calendar_exceptions_date_idx" ON "business_calendar_exceptions" USING btree ("tenant_id","calendar_version_id","local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "business_calendar_versions_number_idx" ON "business_calendar_versions" USING btree ("tenant_id","calendar_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "business_calendars_name_idx" ON "business_calendars" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "internal_notifications_dedupe_idx" ON "internal_notifications" USING btree ("tenant_id","membership_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "internal_notifications_unread_idx" ON "internal_notifications" USING btree ("tenant_id","membership_id","read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_reminders_idempotency_idx" ON "resource_reminders" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "resource_reminders_due_idx" ON "resource_reminders" USING btree ("tenant_id","status","remind_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_instance_events_dedupe_idx" ON "sla_instance_events" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_instances_resource_active_idx" ON "sla_instances" USING btree ("tenant_id","resource","resource_id","policy_id") WHERE "sla_instances"."status" in ('active','paused');--> statement-breakpoint
CREATE INDEX "sla_instances_due_idx" ON "sla_instances" USING btree ("tenant_id","status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_policies_name_idx" ON "sla_policies" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_policy_versions_number_idx" ON "sla_policy_versions" USING btree ("tenant_id","policy_id","version_number");--> statement-breakpoint
--> statement-breakpoint
REVOKE ALL ON TABLE "automation_events", "automation_rules", "automation_rule_versions", "automation_rule_runs", "automation_action_runs", "automation_jobs", "assignment_queues", "assignment_queue_members", "assignment_queue_state", "member_work_availability", "business_calendars", "business_calendar_versions", "business_calendar_intervals", "business_calendar_exceptions", "sla_policies", "sla_policy_versions", "sla_instances", "sla_instance_events", "resource_reminders", "internal_notifications", "notification_preferences" FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "automation_events", "automation_rules", "automation_rule_versions", "automation_rule_runs", "automation_action_runs", "automation_jobs", "assignment_queues", "assignment_queue_members", "assignment_queue_state", "member_work_availability", "business_calendars", "business_calendar_versions", "business_calendar_intervals", "business_calendar_exceptions", "sla_policies", "sla_policy_versions", "sla_instances", "sla_instance_events", "resource_reminders", "internal_notifications", "notification_preferences" TO crm_runtime, crm_worker;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'automation_events', 'automation_rules', 'automation_rule_versions',
    'automation_rule_runs', 'automation_action_runs', 'automation_jobs',
    'assignment_queues', 'assignment_queue_members', 'assignment_queue_state',
    'member_work_availability', 'business_calendars', 'business_calendar_versions',
    'business_calendar_intervals', 'business_calendar_exceptions', 'sla_policies',
    'sla_policy_versions', 'sla_instances', 'sla_instance_events',
    'resource_reminders', 'internal_notifications', 'notification_preferences'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END $$;
