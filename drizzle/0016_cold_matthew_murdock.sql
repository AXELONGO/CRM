CREATE TYPE "public"."agreement_record_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."agreement_review_area" AS ENUM('commercial', 'legal_internal', 'finance');--> statement-breakpoint
CREATE TYPE "public"."agreement_review_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TABLE "agreement_clause_blocks" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"compatible_types" jsonb NOT NULL,
	"status" "agreement_record_status" DEFAULT 'draft' NOT NULL,
	"active_version_id" text,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_clause_blocks_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_clause_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"clause_block_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"content_markdown" text NOT NULL,
	"legal_review_status" text DEFAULT 'unreviewed' NOT NULL,
	"content_hash" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_clause_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_internal_reviews" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"agreement_id" text NOT NULL,
	"version_candidate" integer NOT NULL,
	"area" "agreement_review_area" NOT NULL,
	"decision" "agreement_review_decision" NOT NULL,
	"comment" text,
	"reviewer_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_internal_reviews_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "agreement_reviews_rejection_comment_check" CHECK ("agreement_internal_reviews"."decision" = 'approved' or char_length(coalesce("agreement_internal_reviews"."comment", '')) >= 5)
);
--> statement-breakpoint
CREATE TABLE "agreement_review_policies" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'disabled' NOT NULL,
	"separation_of_duties" boolean DEFAULT true NOT NULL,
	"finance_review_payment_schedule" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_template_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"template_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"sections" jsonb NOT NULL,
	"variables" jsonb NOT NULL,
	"consent_text" text NOT NULL,
	"content_hash" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_template_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_templates" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"document_type" "agreement_type" NOT NULL,
	"pricing_model" text NOT NULL,
	"status" "agreement_record_status" DEFAULT 'draft' NOT NULL,
	"active_version_id" text,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_templates_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "agreement_clause_blocks" ADD CONSTRAINT "agreement_clause_blocks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_clause_blocks" ADD CONSTRAINT "agreement_clause_blocks_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_clause_blocks" ADD CONSTRAINT "agreement_clause_blocks_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_clause_versions" ADD CONSTRAINT "agreement_clause_versions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_clause_versions" ADD CONSTRAINT "agreement_clause_versions_block_same_tenant_fk" FOREIGN KEY ("tenant_id","clause_block_id") REFERENCES "public"."agreement_clause_blocks"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_internal_reviews" ADD CONSTRAINT "agreement_internal_reviews_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_internal_reviews" ADD CONSTRAINT "agreement_reviews_agreement_same_tenant_fk" FOREIGN KEY ("tenant_id","agreement_id") REFERENCES "public"."agreements"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_review_policies" ADD CONSTRAINT "agreement_review_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_review_policies" ADD CONSTRAINT "agreement_review_policies_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_template_versions" ADD CONSTRAINT "agreement_template_versions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_template_versions" ADD CONSTRAINT "agreement_template_versions_template_same_tenant_fk" FOREIGN KEY ("tenant_id","template_id") REFERENCES "public"."agreement_templates"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_templates" ADD CONSTRAINT "agreement_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_templates" ADD CONSTRAINT "agreement_templates_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_templates" ADD CONSTRAINT "agreement_templates_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_clause_blocks_name_unique" ON "agreement_clause_blocks" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_clause_versions_number_unique" ON "agreement_clause_versions" USING btree ("tenant_id","clause_block_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_reviews_area_candidate_unique" ON "agreement_internal_reviews" USING btree ("tenant_id","agreement_id","version_candidate","area");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_template_versions_number_unique" ON "agreement_template_versions" USING btree ("tenant_id","template_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_templates_name_unique" ON "agreement_templates" USING btree ("tenant_id","name");
--> statement-breakpoint
ALTER TABLE "agreement_clause_blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_clause_blocks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_clause_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_clause_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_template_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_template_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_review_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_review_policies" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_internal_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_internal_reviews" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "agreement_clause_blocks_tenant_policy" ON "agreement_clause_blocks" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_clause_versions_tenant_policy" ON "agreement_clause_versions" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_templates_tenant_policy" ON "agreement_templates" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_template_versions_tenant_policy" ON "agreement_template_versions" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_review_policies_tenant_policy" ON "agreement_review_policies" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_internal_reviews_tenant_policy" ON "agreement_internal_reviews" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "agreement_clause_blocks", "agreement_clause_versions", "agreement_templates", "agreement_template_versions", "agreement_review_policies", "agreement_internal_reviews" TO crm_runtime, crm_worker;
