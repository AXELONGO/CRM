CREATE TYPE "public"."content_state" AS ENUM('idea', 'brief', 'in_production', 'internal_review', 'client_review', 'changes_requested', 'approved', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."editorial_channel" AS ENUM('instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'blog', 'email', 'other');--> statement-breakpoint
CREATE TYPE "public"."editorial_review_decision" AS ENUM('approved', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."editorial_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_idea_status" AS ENUM('backlog', 'selected', 'converted', 'archived');--> statement-breakpoint
CREATE TABLE "content_ideas" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"brand_id" text,
	"account_id" text,
	"title" text NOT NULL,
	"body" text,
	"status" "content_idea_status" DEFAULT 'backlog' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_ideas_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_items" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"campaign_id" text,
	"pillar_id" text,
	"project_id" text,
	"title" text NOT NULL,
	"objective" text,
	"audience" text,
	"key_message" text,
	"state" "content_state" DEFAULT 'idea' NOT NULL,
	"planned_date" text,
	"timezone" text DEFAULT 'America/Tijuana' NOT NULL,
	"owner_membership_id" text,
	"source_idea_id" text,
	"source_note_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_items_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_notes" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "content_notes_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reviews" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"content_item_id" text NOT NULL,
	"reviewer_membership_id" text NOT NULL,
	"decision" "editorial_review_decision" NOT NULL,
	"comment" text,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_reviews_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_variants" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"content_item_id" text NOT NULL,
	"channel" "editorial_channel" NOT NULL,
	"format" text NOT NULL,
	"copy_text" text,
	"storyboard" text,
	"visual_direction" text,
	"planned_at" timestamp with time zone,
	"timezone" text DEFAULT 'America/Tijuana' NOT NULL,
	"position" bigint DEFAULT 1024 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "content_variants_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "editorial_brands" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"account_id" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"brand_type" text NOT NULL,
	"description" text,
	"tone" text,
	"locale" text DEFAULT 'es-MX' NOT NULL,
	"timezone" text DEFAULT 'America/Tijuana' NOT NULL,
	"status" "editorial_status" DEFAULT 'active' NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_brands_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "editorial_campaigns" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"status" "editorial_status" DEFAULT 'active' NOT NULL,
	"start_date" text,
	"end_date" text,
	CONSTRAINT "editorial_campaigns_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "editorial_pillars" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "editorial_status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "editorial_pillars_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_idea_brand_same_tenant_fk" FOREIGN KEY ("tenant_id","brand_id") REFERENCES "public"."editorial_brands"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_item_brand_same_tenant_fk" FOREIGN KEY ("tenant_id","brand_id") REFERENCES "public"."editorial_brands"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_item_campaign_same_tenant_fk" FOREIGN KEY ("tenant_id","campaign_id") REFERENCES "public"."editorial_campaigns"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_item_pillar_same_tenant_fk" FOREIGN KEY ("tenant_id","pillar_id") REFERENCES "public"."editorial_pillars"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_items" ADD CONSTRAINT "content_item_project_same_tenant_fk" FOREIGN KEY ("tenant_id","project_id") REFERENCES "public"."projects"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_review_item_same_tenant_fk" FOREIGN KEY ("tenant_id","content_item_id") REFERENCES "public"."content_items"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_review_reviewer_same_tenant_fk" FOREIGN KEY ("tenant_id","reviewer_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_variants" ADD CONSTRAINT "content_variant_item_same_tenant_fk" FOREIGN KEY ("tenant_id","content_item_id") REFERENCES "public"."content_items"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_brands" ADD CONSTRAINT "editorial_brand_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_campaigns" ADD CONSTRAINT "editorial_campaign_brand_same_tenant_fk" FOREIGN KEY ("tenant_id","brand_id") REFERENCES "public"."editorial_brands"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_pillars" ADD CONSTRAINT "editorial_pillar_brand_same_tenant_fk" FOREIGN KEY ("tenant_id","brand_id") REFERENCES "public"."editorial_brands"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_ideas_backlog_idx" ON "content_ideas" USING btree ("tenant_id","status","priority");--> statement-breakpoint
CREATE INDEX "content_items_calendar_idx" ON "content_items" USING btree ("tenant_id","planned_date","state");--> statement-breakpoint
CREATE INDEX "content_outbox_tenant_created_idx" ON "content_outbox_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "content_variant_channel_unique" ON "content_variants" USING btree ("tenant_id","content_item_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_brand_slug_unique" ON "editorial_brands" USING btree ("tenant_id","slug");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "content_ideas", "content_items", "content_notes", "content_outbox_events", "content_reviews", "content_variants", "editorial_brands", "editorial_campaigns", "editorial_pillars" TO crm_runtime, crm_worker;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'content_ideas', 'content_items', 'content_notes', 'content_outbox_events',
    'content_reviews', 'content_variants', 'editorial_brands',
    'editorial_campaigns', 'editorial_pillars'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END $$;
