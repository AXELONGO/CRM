CREATE TYPE "public"."agreement_action" AS ENUM('accepted', 'declined', 'changes_requested');--> statement-breakpoint
CREATE TYPE "public"."agreement_method" AS ENUM('internal_electronic_acceptance', 'external_signed_pdf');--> statement-breakpoint
CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'pending_internal_review', 'ready_to_issue', 'issued', 'partially_accepted', 'signatures_complete', 'executed', 'changes_requested', 'declined', 'expired', 'voided');--> statement-breakpoint
CREATE TYPE "public"."agreement_type" AS ENUM('fixed_project_service_agreement', 'hourly_consulting_agreement', 'retainer_service_agreement', 'signable_proposal', 'statement_of_work');--> statement-breakpoint
CREATE TYPE "public"."agreement_envelope_status" AS ENUM('draft', 'ready', 'sent', 'partially_completed', 'signatures_complete', 'completed', 'declined', 'changes_requested', 'expired', 'voided');--> statement-breakpoint
CREATE TYPE "public"."agreement_evidence_status" AS ENUM('building', 'sealed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."agreement_external_review_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."agreement_recipient_status" AS ENUM('pending', 'available', 'viewed', 'accepted', 'declined', 'changes_requested', 'expired');--> statement-breakpoint
CREATE TYPE "public"."agreement_recipient_type" AS ENUM('internal_member', 'external_contact');--> statement-breakpoint
CREATE TYPE "public"."agreement_signing_order" AS ENUM('provider_first', 'customer_first', 'parallel');--> statement-breakpoint
CREATE TABLE "agreement_acceptance_actions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"agreement_id" text NOT NULL,
	"version_id" text NOT NULL,
	"envelope_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"action" "agreement_action" NOT NULL,
	"actor_kind" "agreement_recipient_type" NOT NULL,
	"declared_full_name" text NOT NULL,
	"declared_authority" boolean DEFAULT false NOT NULL,
	"consent_version" text NOT NULL,
	"consent_hash" text NOT NULL,
	"content_sha256" text NOT NULL,
	"content_pdf_sha256" text,
	"email_fingerprint" text NOT NULL,
	"comment" text,
	"idempotency_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_acceptance_actions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_drafts" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"agreement_id" text NOT NULL,
	"title" text NOT NULL,
	"preamble" text,
	"document_type" "agreement_type" NOT NULL,
	"effective_date_rule" text NOT NULL,
	"term" jsonb NOT NULL,
	"parties" jsonb NOT NULL,
	"sections" jsonb NOT NULL,
	"payment_schedule" jsonb NOT NULL,
	"internal_notes" text,
	"expected_version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_drafts_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_envelopes" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"agreement_id" text NOT NULL,
	"version_id" text NOT NULL,
	"method" "agreement_method" NOT NULL,
	"signing_order" "agreement_signing_order" NOT NULL,
	"status" "agreement_envelope_status" DEFAULT 'ready' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"sender_membership_id" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_envelopes_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_evidence_bundles" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"agreement_id" text NOT NULL,
	"version_id" text NOT NULL,
	"envelope_id" text NOT NULL,
	"status" "agreement_evidence_status" DEFAULT 'building' NOT NULL,
	"canonical_evidence" jsonb NOT NULL,
	"evidence_sha256" text NOT NULL,
	"hmac_algorithm" text DEFAULT 'HMAC-SHA-256' NOT NULL,
	"key_version" integer NOT NULL,
	"evidence_seal" text NOT NULL,
	"final_pdf_key" text,
	"final_pdf_sha256" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_evidence_bundles_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_external_execution_records" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"agreement_id" text NOT NULL,
	"version_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"mime_type" text NOT NULL,
	"review_status" "agreement_external_review_status" DEFAULT 'pending' NOT NULL,
	"uploaded_by_user_id" text NOT NULL,
	"reviewed_by_user_id" text,
	"reviewer_comment" text,
	"declared_signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "agreement_external_execution_records_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "agreement_external_pdf_check" CHECK ("agreement_external_execution_records"."mime_type" = 'application/pdf' and "agreement_external_execution_records"."size_bytes" between 1 and 15728640)
);
--> statement-breakpoint
CREATE TABLE "agreement_number_sequences" (
	"tenant_id" text NOT NULL,
	"year" integer NOT NULL,
	"prefix" text DEFAULT 'CTR' NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_number_sequences_tenant_id_year_pk" PRIMARY KEY("tenant_id","year"),
	CONSTRAINT "agreement_number_sequences_value_check" CHECK ("agreement_number_sequences"."next_value" > 0)
);
--> statement-breakpoint
CREATE TABLE "agreement_outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_public_sessions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"session_hash" text NOT NULL,
	"csrf_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_public_sessions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_recipient_links" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"generation" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agreement_recipient_links_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreement_recipients" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"envelope_id" text NOT NULL,
	"party_side" text NOT NULL,
	"recipient_type" "agreement_recipient_type" NOT NULL,
	"membership_id" text,
	"contact_id" text,
	"name_snapshot" text NOT NULL,
	"email_snapshot" text NOT NULL,
	"role_snapshot" text NOT NULL,
	"signing_order" integer NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"status" "agreement_recipient_status" DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"acted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_recipients_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "agreement_recipients_order_check" CHECK ("agreement_recipients"."signing_order" between 1 and 2)
);
--> statement-breakpoint
CREATE TABLE "agreement_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"agreement_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"document_number" text NOT NULL,
	"status" "agreement_status" NOT NULL,
	"source_quote_id" text NOT NULL,
	"source_quote_version_id" text NOT NULL,
	"source_quote_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"content_sha256" text NOT NULL,
	"content_pdf_key" text,
	"content_pdf_sha256" text,
	"renderer_version" text,
	"issued_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreement_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"agreement_type" "agreement_type" NOT NULL,
	"status" "agreement_status" DEFAULT 'draft' NOT NULL,
	"number" text,
	"title" text NOT NULL,
	"quote_id" text NOT NULL,
	"quote_version_id" text NOT NULL,
	"opportunity_id" text,
	"account_id" text,
	"contact_id" text,
	"owner_membership_id" text NOT NULL,
	"current_draft_id" text,
	"current_version_id" text,
	"active_envelope_id" text,
	"execution_method" "agreement_method",
	"executed_version_id" text,
	"effective_date_rule" text DEFAULT 'on_full_execution' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agreements_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "agreements_title_check" CHECK (char_length("agreements"."title") between 2 and 200)
);
--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" ADD CONSTRAINT "agreement_actions_agreement_same_tenant_fk" FOREIGN KEY ("tenant_id","agreement_id") REFERENCES "public"."agreements"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" ADD CONSTRAINT "agreement_actions_version_same_tenant_fk" FOREIGN KEY ("tenant_id","version_id") REFERENCES "public"."agreement_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" ADD CONSTRAINT "agreement_actions_envelope_same_tenant_fk" FOREIGN KEY ("tenant_id","envelope_id") REFERENCES "public"."agreement_envelopes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" ADD CONSTRAINT "agreement_actions_recipient_same_tenant_fk" FOREIGN KEY ("tenant_id","recipient_id") REFERENCES "public"."agreement_recipients"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_drafts" ADD CONSTRAINT "agreement_drafts_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_drafts" ADD CONSTRAINT "agreement_drafts_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_drafts" ADD CONSTRAINT "agreement_drafts_agreement_same_tenant_fk" FOREIGN KEY ("tenant_id","agreement_id") REFERENCES "public"."agreements"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_envelopes" ADD CONSTRAINT "agreement_envelopes_agreement_same_tenant_fk" FOREIGN KEY ("tenant_id","agreement_id") REFERENCES "public"."agreements"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_envelopes" ADD CONSTRAINT "agreement_envelopes_version_same_tenant_fk" FOREIGN KEY ("tenant_id","version_id") REFERENCES "public"."agreement_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_evidence_bundles" ADD CONSTRAINT "agreement_evidence_agreement_same_tenant_fk" FOREIGN KEY ("tenant_id","agreement_id") REFERENCES "public"."agreements"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_evidence_bundles" ADD CONSTRAINT "agreement_evidence_version_same_tenant_fk" FOREIGN KEY ("tenant_id","version_id") REFERENCES "public"."agreement_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_evidence_bundles" ADD CONSTRAINT "agreement_evidence_envelope_same_tenant_fk" FOREIGN KEY ("tenant_id","envelope_id") REFERENCES "public"."agreement_envelopes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_external_execution_records" ADD CONSTRAINT "agreement_external_execution_records_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_external_execution_records" ADD CONSTRAINT "agreement_external_execution_records_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_external_execution_records" ADD CONSTRAINT "agreement_external_agreement_same_tenant_fk" FOREIGN KEY ("tenant_id","agreement_id") REFERENCES "public"."agreements"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_external_execution_records" ADD CONSTRAINT "agreement_external_version_same_tenant_fk" FOREIGN KEY ("tenant_id","version_id") REFERENCES "public"."agreement_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_number_sequences" ADD CONSTRAINT "agreement_number_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_outbox_events" ADD CONSTRAINT "agreement_outbox_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_public_sessions" ADD CONSTRAINT "agreement_public_sessions_recipient_same_tenant_fk" FOREIGN KEY ("tenant_id","recipient_id") REFERENCES "public"."agreement_recipients"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_recipient_links" ADD CONSTRAINT "agreement_recipient_links_recipient_same_tenant_fk" FOREIGN KEY ("tenant_id","recipient_id") REFERENCES "public"."agreement_recipients"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_recipients" ADD CONSTRAINT "agreement_recipients_envelope_same_tenant_fk" FOREIGN KEY ("tenant_id","envelope_id") REFERENCES "public"."agreement_envelopes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_agreement_same_tenant_fk" FOREIGN KEY ("tenant_id","agreement_id") REFERENCES "public"."agreements"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_quote_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_id") REFERENCES "public"."quotes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_quote_version_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_version_id") REFERENCES "public"."quote_versions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_actions_idempotency_unique" ON "agreement_acceptance_actions" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_actions_recipient_terminal_unique" ON "agreement_acceptance_actions" USING btree ("tenant_id","recipient_id") WHERE "agreement_acceptance_actions"."action" in ('accepted', 'declined', 'changes_requested');--> statement-breakpoint
CREATE INDEX "agreement_drafts_agreement_idx" ON "agreement_drafts" USING btree ("tenant_id","agreement_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_envelopes_active_version_unique" ON "agreement_envelopes" USING btree ("tenant_id","version_id") WHERE "agreement_envelopes"."status" not in ('completed', 'declined', 'expired', 'voided');--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_evidence_version_unique" ON "agreement_evidence_bundles" USING btree ("tenant_id","version_id");--> statement-breakpoint
CREATE INDEX "agreement_outbox_tenant_created_idx" ON "agreement_outbox_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_public_sessions_hash_unique" ON "agreement_public_sessions" USING btree ("session_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_recipient_links_token_unique" ON "agreement_recipient_links" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_recipient_links_active_unique" ON "agreement_recipient_links" USING btree ("tenant_id","recipient_id","generation") WHERE "agreement_recipient_links"."active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_recipients_party_unique" ON "agreement_recipients" USING btree ("tenant_id","envelope_id","party_side");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_versions_number_unique" ON "agreement_versions" USING btree ("tenant_id","agreement_id","version_number");--> statement-breakpoint
CREATE INDEX "agreement_versions_hash_idx" ON "agreement_versions" USING btree ("tenant_id","content_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "agreements_number_unique" ON "agreements" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "agreements_executed_quote_unique" ON "agreements" USING btree ("tenant_id","quote_id") WHERE "agreements"."status" = 'executed';--> statement-breakpoint
CREATE INDEX "agreements_status_updated_idx" ON "agreements" USING btree ("tenant_id","status","updated_at");
--> statement-breakpoint
ALTER TABLE "agreement_number_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_number_sequences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_drafts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_envelopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_envelopes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_recipients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_recipient_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_recipient_links" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_public_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_public_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_acceptance_actions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_evidence_bundles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_evidence_bundles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_external_execution_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_external_execution_records" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_outbox_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "agreement_outbox_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "agreements_tenant_policy" ON "agreements" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_number_sequences_tenant_policy" ON "agreement_number_sequences" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_drafts_tenant_policy" ON "agreement_drafts" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_versions_tenant_policy" ON "agreement_versions" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_envelopes_tenant_policy" ON "agreement_envelopes" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_recipients_tenant_policy" ON "agreement_recipients" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_recipient_links_tenant_policy" ON "agreement_recipient_links" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_public_sessions_tenant_policy" ON "agreement_public_sessions" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_acceptance_actions_tenant_policy" ON "agreement_acceptance_actions" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_evidence_bundles_tenant_policy" ON "agreement_evidence_bundles" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_external_execution_records_tenant_policy" ON "agreement_external_execution_records" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_outbox_events_tenant_policy" ON "agreement_outbox_events" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_recipient_links_ingress_lookup" ON "agreement_recipient_links" FOR SELECT TO crm_ingress USING (active AND expires_at > now());--> statement-breakpoint
CREATE POLICY "agreement_public_ingress_policy" ON "agreement_recipients" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_envelopes_ingress_policy" ON "agreement_envelopes" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_versions_ingress_policy" ON "agreement_versions" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreements_ingress_policy" ON "agreements" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_public_sessions_ingress_policy" ON "agreement_public_sessions" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "agreement_actions_ingress_policy" ON "agreement_acceptance_actions" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "agreement_number_sequences", "agreements", "agreement_drafts", "agreement_versions", "agreement_envelopes", "agreement_recipients", "agreement_recipient_links", "agreement_public_sessions", "agreement_acceptance_actions", "agreement_evidence_bundles", "agreement_external_execution_records", "agreement_outbox_events" TO crm_runtime, crm_worker, crm_ingress;
