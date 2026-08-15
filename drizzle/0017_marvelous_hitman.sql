CREATE TYPE "public"."quote_challenge_status" AS ENUM('pending', 'verified', 'expired', 'locked', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."quote_decision" AS ENUM('accepted', 'rejected', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."quote_record_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'pending_internal_approval' BEFORE 'issued';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'ready_to_issue' BEFORE 'issued';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'viewed' BEFORE 'accepted';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'changes_requested' BEFORE 'accepted';--> statement-breakpoint
CREATE TABLE "commercial_tax_rates" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"rate_bps" bigint NOT NULL,
	"status" "quote_record_status" DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commercial_tax_rates_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "commercial_tax_rates_bps_check" CHECK ("commercial_tax_rates"."rate_bps" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "quote_client_decisions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"quote_version_id" text NOT NULL,
	"decision" "quote_decision" NOT NULL,
	"declared_full_name" text NOT NULL,
	"email_fingerprint" text NOT NULL,
	"challenge_id" text NOT NULL,
	"session_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"pdf_hash" text,
	"consent_version" text NOT NULL,
	"comment" text,
	"idempotency_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_client_decisions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "quote_draft_items" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"position" integer NOT NULL,
	"item_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"quantity" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"discount_type" "quote_discount_type" DEFAULT 'none' NOT NULL,
	"discount_value" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" bigint DEFAULT 0 NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_draft_items_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "quote_draft_sections" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"section_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_draft_sections_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "quote_drafts" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"pricing_model" text NOT NULL,
	"currency" text NOT NULL,
	"validity_days" integer,
	"client_notes" text,
	"internal_notes" text,
	"optimistic_version" integer DEFAULT 1 NOT NULL,
	"calculated_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_drafts_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "quote_email_challenges" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"session_id" text NOT NULL,
	"email_fingerprint" text NOT NULL,
	"code_hash" text NOT NULL,
	"status" "quote_challenge_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_email_challenges_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "commercial_tax_rates" ADD CONSTRAINT "commercial_tax_rates_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_client_decisions" ADD CONSTRAINT "quote_decisions_quote_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_id") REFERENCES "public"."quotes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_client_decisions" ADD CONSTRAINT "quote_decisions_version_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_version_id") REFERENCES "public"."quote_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_draft_items" ADD CONSTRAINT "quote_draft_items_draft_same_tenant_fk" FOREIGN KEY ("tenant_id","draft_id") REFERENCES "public"."quote_drafts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_draft_sections" ADD CONSTRAINT "quote_draft_sections_draft_same_tenant_fk" FOREIGN KEY ("tenant_id","draft_id") REFERENCES "public"."quote_drafts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_drafts" ADD CONSTRAINT "quote_drafts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_drafts" ADD CONSTRAINT "quote_drafts_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_drafts" ADD CONSTRAINT "quote_drafts_quote_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_id") REFERENCES "public"."quotes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_email_challenges" ADD CONSTRAINT "quote_challenges_session_same_tenant_fk" FOREIGN KEY ("tenant_id","session_id") REFERENCES "public"."quote_public_sessions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commercial_tax_rates_label_unique" ON "commercial_tax_rates" USING btree ("tenant_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_decisions_idempotency_unique" ON "quote_client_decisions" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_decisions_terminal_unique" ON "quote_client_decisions" USING btree ("tenant_id","quote_id") WHERE "quote_client_decisions"."decision" in ('accepted','rejected');--> statement-breakpoint
CREATE UNIQUE INDEX "quote_draft_items_position_unique" ON "quote_draft_items" USING btree ("tenant_id","draft_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_draft_sections_position_unique" ON "quote_draft_sections" USING btree ("tenant_id","draft_id","position");--> statement-breakpoint
CREATE INDEX "quote_drafts_quote_updated_idx" ON "quote_drafts" USING btree ("tenant_id","quote_id","updated_at");--> statement-breakpoint
CREATE INDEX "quote_challenges_session_status_idx" ON "quote_email_challenges" USING btree ("tenant_id","session_id","status");
--> statement-breakpoint
ALTER TABLE "commercial_tax_rates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commercial_tax_rates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_drafts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_draft_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_draft_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_draft_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_draft_sections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_client_decisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_client_decisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_email_challenges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_email_challenges" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "quote_prompt9_tenant_policy" ON "commercial_tax_rates" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_drafts_tenant_policy" ON "quote_drafts" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_draft_items_tenant_policy" ON "quote_draft_items" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_draft_sections_tenant_policy" ON "quote_draft_sections" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_client_decisions_tenant_policy" ON "quote_client_decisions" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_email_challenges_tenant_policy" ON "quote_email_challenges" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_prompt9_ingress_policy" ON "quote_client_decisions" FOR SELECT TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_challenges_ingress_policy" ON "quote_email_challenges" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "commercial_tax_rates", "quote_drafts", "quote_draft_items", "quote_draft_sections", "quote_client_decisions", "quote_email_challenges" TO crm_runtime, crm_worker, crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.resolve_quote_public_session(p_session_hash text)
RETURNS TABLE(tenant_id text, quote_id text, session_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT tenant_id, quote_id, id
  FROM public.quote_public_sessions
  WHERE session_hash = p_session_hash
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.resolve_quote_public_session(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_quote_public_session(text) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.resolve_quote_public_link(p_token_hash text)
RETURNS TABLE(tenant_id text, quote_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT tenant_id, quote_id
  FROM public.quote_public_links
  WHERE token_hash = p_token_hash
    AND active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.resolve_quote_public_link(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_quote_public_link(text) TO crm_ingress;
