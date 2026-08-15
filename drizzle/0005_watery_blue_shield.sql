CREATE TYPE "public"."sales_activity_status" AS ENUM('planned', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sales_activity_type" AS ENUM('call', 'meeting', 'email', 'whatsapp', 'task', 'note');--> statement-breakpoint
CREATE TYPE "public"."sales_history_source" AS ENUM('manual', 'kanban', 'system', 'import');--> statement-breakpoint
CREATE TYPE "public"."sales_opportunity_state" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."sales_participant_role" AS ENUM('decision_maker', 'influencer', 'billing', 'technical', 'other');--> statement-breakpoint
CREATE TYPE "public"."sales_pipeline_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sales_pricing_model" AS ENUM('fixed_price', 'hourly', 'retainer', 'other');--> statement-breakpoint
CREATE TYPE "public"."sales_record_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "sales_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"contact_id" text,
	"account_id" text,
	"type" "sales_activity_type" NOT NULL,
	"status" "sales_activity_status" DEFAULT 'planned' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduled_at" timestamp,
	"owner_membership_id" text NOT NULL,
	"completed_at" timestamp,
	"result" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	CONSTRAINT "sales_activities_title_length_check" CHECK (char_length("sales_activities"."title") between 1 and 200),
	CONSTRAINT "sales_activities_description_length_check" CHECK ("sales_activities"."description" is null or char_length("sales_activities"."description") <= 5000),
	CONSTRAINT "sales_activities_result_length_check" CHECK ("sales_activities"."result" is null or char_length("sales_activities"."result") <= 2000),
	CONSTRAINT "sales_activities_planned_fields_check" CHECK ("sales_activities"."status" <> 'planned' or "sales_activities"."scheduled_at" is not null),
	CONSTRAINT "sales_activities_completed_fields_check" CHECK ("sales_activities"."status" <> 'completed' or "sales_activities"."completed_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "sales_domain_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"event_type" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"opportunity_id" text NOT NULL,
	"payload" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_lead_sources" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"status" "sales_record_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "sales_lead_sources_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "sales_lost_reasons" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"status" "sales_record_status" DEFAULT 'active' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "sales_lost_reasons_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "sales_opportunities" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"pipeline_id" text NOT NULL,
	"stage_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"primary_contact_id" text,
	"account_id" text,
	"owner_membership_id" text NOT NULL,
	"source_id" text,
	"state" "sales_opportunity_state" DEFAULT 'open' NOT NULL,
	"record_status" "sales_record_status" DEFAULT 'active' NOT NULL,
	"pricing_model" "sales_pricing_model" NOT NULL,
	"currency" text NOT NULL,
	"estimated_value_minor" bigint NOT NULL,
	"hourly_rate_minor" bigint,
	"estimated_hours" integer,
	"retainer_monthly_minor" bigint,
	"retainer_duration_months" integer,
	"pricing_explanation" text,
	"probability_override" integer,
	"expected_close_date" timestamp,
	"position" bigint NOT NULL,
	"stage_changed_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"final_value_minor" bigint,
	"lost_reason_id" text,
	"lost_explanation" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"archived_by_user_id" text,
	CONSTRAINT "sales_opportunities_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "sales_opportunities_title_length_check" CHECK (char_length("sales_opportunities"."title") between 2 and 200),
	CONSTRAINT "sales_opportunities_summary_length_check" CHECK ("sales_opportunities"."summary" is null or char_length("sales_opportunities"."summary") <= 5000),
	CONSTRAINT "sales_opportunities_currency_check" CHECK ("sales_opportunities"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "sales_opportunities_estimated_value_check" CHECK ("sales_opportunities"."estimated_value_minor" >= 0),
	CONSTRAINT "sales_opportunities_probability_check" CHECK ("sales_opportunities"."probability_override" is null or "sales_opportunities"."probability_override" between 0 and 100),
	CONSTRAINT "sales_opportunities_contact_or_account_check" CHECK ("sales_opportunities"."primary_contact_id" is not null or "sales_opportunities"."account_id" is not null),
	CONSTRAINT "sales_opportunities_open_terminal_fields_check" CHECK ("sales_opportunities"."state" <> 'open' or ("sales_opportunities"."closed_at" is null and "sales_opportunities"."final_value_minor" is null and "sales_opportunities"."lost_reason_id" is null)),
	CONSTRAINT "sales_opportunities_won_fields_check" CHECK ("sales_opportunities"."state" <> 'won' or ("sales_opportunities"."closed_at" is not null and "sales_opportunities"."lost_reason_id" is null)),
	CONSTRAINT "sales_opportunities_lost_fields_check" CHECK ("sales_opportunities"."state" <> 'lost' or ("sales_opportunities"."closed_at" is not null and "sales_opportunities"."lost_reason_id" is not null)),
	CONSTRAINT "sales_opportunities_pricing_values_check" CHECK ("sales_opportunities"."hourly_rate_minor" is null or "sales_opportunities"."hourly_rate_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales_opportunity_participants" (
	"tenant_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"role" "sales_participant_role" DEFAULT 'other' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "sales_opportunity_participants_tenant_id_opportunity_id_contact_id_pk" PRIMARY KEY("tenant_id","opportunity_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "sales_pipeline_stages" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"pipeline_id" text NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"color" text NOT NULL,
	"position" bigint NOT NULL,
	"default_probability" integer NOT NULL,
	"stale_after_days" integer,
	"is_initial" boolean DEFAULT false NOT NULL,
	"status" "sales_record_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	CONSTRAINT "sales_pipeline_stages_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "sales_stages_probability_check" CHECK ("sales_pipeline_stages"."default_probability" between 0 and 100),
	CONSTRAINT "sales_stages_stale_days_check" CHECK ("sales_pipeline_stages"."stale_after_days" is null or "sales_pipeline_stages"."stale_after_days" > 0),
	CONSTRAINT "sales_stages_color_check" CHECK ("sales_pipeline_stages"."color" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "sales_stages_name_length_check" CHECK (char_length("sales_pipeline_stages"."name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "sales_pipelines" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"description" text,
	"status" "sales_pipeline_status" DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"template_key" text,
	"template_version" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"archived_by_user_id" text,
	CONSTRAINT "sales_pipelines_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "sales_pipelines_name_length_check" CHECK (char_length("sales_pipelines"."name") between 2 and 120),
	CONSTRAINT "sales_pipelines_description_length_check" CHECK ("sales_pipelines"."description" is null or char_length("sales_pipelines"."description") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "sales_stage_history" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"pipeline_id" text NOT NULL,
	"from_stage_id" text,
	"to_stage_id" text NOT NULL,
	"actor_user_id" text,
	"source" "sales_history_source" NOT NULL,
	"resulting_version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_state_history" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"opportunity_id" text NOT NULL,
	"from_state" "sales_opportunity_state",
	"to_state" "sales_opportunity_state" NOT NULL,
	"actor_user_id" text,
	"reason_id" text,
	"explanation" text,
	"resulting_version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_state_history_explanation_length_check" CHECK ("sales_state_history"."explanation" is null or char_length("sales_state_history"."explanation") <= 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sales_stages_pipeline_id_unique" ON "sales_pipeline_stages" USING btree ("tenant_id","pipeline_id","id");--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_opportunity_same_tenant_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."sales_opportunities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_domain_events" ADD CONSTRAINT "sales_domain_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_domain_events" ADD CONSTRAINT "sales_domain_events_opportunity_same_tenant_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."sales_opportunities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_lead_sources" ADD CONSTRAINT "sales_lead_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_lead_sources" ADD CONSTRAINT "sales_lead_sources_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_lost_reasons" ADD CONSTRAINT "sales_lost_reasons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_lost_reasons" ADD CONSTRAINT "sales_lost_reasons_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_pipeline_same_tenant_fk" FOREIGN KEY ("tenant_id","pipeline_id") REFERENCES "public"."sales_pipelines"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_stage_same_tenant_fk" FOREIGN KEY ("tenant_id","stage_id") REFERENCES "public"."sales_pipeline_stages"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","primary_contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_source_same_tenant_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."sales_lead_sources"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunities" ADD CONSTRAINT "sales_opportunities_lost_reason_same_tenant_fk" FOREIGN KEY ("tenant_id","lost_reason_id") REFERENCES "public"."sales_lost_reasons"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunity_participants" ADD CONSTRAINT "sales_opportunity_participants_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunity_participants" ADD CONSTRAINT "sales_participants_opportunity_same_tenant_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."sales_opportunities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_opportunity_participants" ADD CONSTRAINT "sales_participants_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_pipeline_stages" ADD CONSTRAINT "sales_pipeline_stages_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_pipeline_stages" ADD CONSTRAINT "sales_pipeline_stages_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_pipeline_stages" ADD CONSTRAINT "sales_stages_pipeline_same_tenant_fk" FOREIGN KEY ("tenant_id","pipeline_id") REFERENCES "public"."sales_pipelines"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_pipelines" ADD CONSTRAINT "sales_pipelines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_pipelines" ADD CONSTRAINT "sales_pipelines_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_pipelines" ADD CONSTRAINT "sales_pipelines_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_pipelines" ADD CONSTRAINT "sales_pipelines_archived_by_user_id_user_id_fk" FOREIGN KEY ("archived_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_stage_history" ADD CONSTRAINT "sales_stage_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_stage_history" ADD CONSTRAINT "sales_stage_history_opportunity_same_tenant_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."sales_opportunities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_stage_history" ADD CONSTRAINT "sales_stage_history_pipeline_same_tenant_fk" FOREIGN KEY ("tenant_id","pipeline_id") REFERENCES "public"."sales_pipelines"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_stage_history" ADD CONSTRAINT "sales_stage_history_to_stage_same_tenant_fk" FOREIGN KEY ("tenant_id","to_stage_id") REFERENCES "public"."sales_pipeline_stages"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_state_history" ADD CONSTRAINT "sales_state_history_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_state_history" ADD CONSTRAINT "sales_state_history_opportunity_same_tenant_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."sales_opportunities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_state_history" ADD CONSTRAINT "sales_state_history_reason_same_tenant_fk" FOREIGN KEY ("tenant_id","reason_id") REFERENCES "public"."sales_lost_reasons"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_activities_opportunity_status_date_idx" ON "sales_activities" USING btree ("tenant_id","opportunity_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "sales_activities_owner_status_date_idx" ON "sales_activities" USING btree ("tenant_id","owner_membership_id","status","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_domain_events_tenant_opportunity_type_unique" ON "sales_domain_events" USING btree ("tenant_id","opportunity_id","event_type");--> statement-breakpoint
CREATE INDEX "sales_domain_events_tenant_occurred_idx" ON "sales_domain_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_sources_key_unique" ON "sales_lead_sources" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "sales_sources_status_idx" ON "sales_lead_sources" USING btree ("tenant_id","status","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_lost_reasons_key_unique" ON "sales_lost_reasons" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX "sales_lost_reasons_status_idx" ON "sales_lost_reasons" USING btree ("tenant_id","status","position");--> statement-breakpoint
CREATE INDEX "sales_opportunities_board_idx" ON "sales_opportunities" USING btree ("tenant_id","pipeline_id","stage_id","state","record_status","position");--> statement-breakpoint
CREATE INDEX "sales_opportunities_owner_state_idx" ON "sales_opportunities" USING btree ("tenant_id","owner_membership_id","state","updated_at");--> statement-breakpoint
CREATE INDEX "sales_opportunities_expected_close_idx" ON "sales_opportunities" USING btree ("tenant_id","state","expected_close_date");--> statement-breakpoint
CREATE INDEX "sales_opportunities_contact_idx" ON "sales_opportunities" USING btree ("tenant_id","primary_contact_id");--> statement-breakpoint
CREATE INDEX "sales_opportunities_account_idx" ON "sales_opportunities" USING btree ("tenant_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_opportunity_primary_participant_unique" ON "sales_opportunity_participants" USING btree ("tenant_id","opportunity_id") WHERE "sales_opportunity_participants"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "sales_stages_active_name_unique" ON "sales_pipeline_stages" USING btree ("tenant_id","pipeline_id","name_normalized") WHERE "sales_pipeline_stages"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "sales_stages_initial_unique" ON "sales_pipeline_stages" USING btree ("tenant_id","pipeline_id") WHERE "sales_pipeline_stages"."status" = 'active' and "sales_pipeline_stages"."is_initial";--> statement-breakpoint
CREATE INDEX "sales_stages_pipeline_position_idx" ON "sales_pipeline_stages" USING btree ("tenant_id","pipeline_id","status","position");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_pipelines_active_name_unique" ON "sales_pipelines" USING btree ("tenant_id","name_normalized") WHERE "sales_pipelines"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "sales_pipelines_default_unique" ON "sales_pipelines" USING btree ("tenant_id") WHERE "sales_pipelines"."status" = 'active' and "sales_pipelines"."is_default";--> statement-breakpoint
CREATE INDEX "sales_pipelines_tenant_status_idx" ON "sales_pipelines" USING btree ("tenant_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "sales_stage_history_opportunity_idx" ON "sales_stage_history" USING btree ("tenant_id","opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "sales_state_history_opportunity_idx" ON "sales_state_history" USING btree ("tenant_id","opportunity_id","created_at");--> statement-breakpoint
REVOKE ALL ON TABLE "sales_activities", "sales_domain_events", "sales_lead_sources", "sales_lost_reasons", "sales_opportunities", "sales_opportunity_participants", "sales_pipeline_stages", "sales_pipelines", "sales_stage_history", "sales_state_history" FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "sales_activities", "sales_domain_events", "sales_lead_sources", "sales_lost_reasons", "sales_opportunities", "sales_opportunity_participants", "sales_pipeline_stages", "sales_pipelines", "sales_stage_history", "sales_state_history" TO crm_runtime;
--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'sales_activities', 'sales_domain_events', 'sales_lead_sources',
    'sales_lost_reasons', 'sales_opportunities',
    'sales_opportunity_participants', 'sales_pipeline_stages',
    'sales_pipelines', 'sales_stage_history', 'sales_state_history'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END
$$;
