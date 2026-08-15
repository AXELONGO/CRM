CREATE TYPE "public"."inbox_channel" AS ENUM('whatsapp_meta', 'whatsapp_waha', 'web_form', 'email', 'meta_lead_ads', 'messenger', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."inbox_connection_status" AS ENUM('draft', 'configured', 'verifying', 'active', 'degraded', 'disabled', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."inbox_conversation_status" AS ENUM('open', 'pending', 'closed', 'spam');--> statement-breakpoint
CREATE TYPE "public"."inbox_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."inbox_form_status" AS ENUM('draft', 'active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."inbox_identity_status" AS ENUM('unresolved', 'linked', 'ambiguous');--> statement-breakpoint
CREATE TYPE "public"."inbox_job_status" AS ENUM('pending', 'processing', 'succeeded', 'retry', 'dead');--> statement-breakpoint
CREATE TYPE "public"."inbox_message_kind" AS ENUM('text', 'image', 'audio', 'video', 'document', 'location', 'contact_card', 'form_submission', 'unsupported');--> statement-breakpoint
CREATE TYPE "public"."inbox_message_status" AS ENUM('received', 'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inbox_priority" AS ENUM('normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."inbox_receipt_status" AS ENUM('received', 'queued', 'processed', 'rejected', 'dead');--> statement-breakpoint
CREATE TABLE "inbox_channel_identities" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"external_participant_id" text NOT NULL,
	"channel" "inbox_channel" NOT NULL,
	"contact_id" text,
	"external_display_name" text,
	"normalized_address" text,
	"status" "inbox_identity_status" DEFAULT 'unresolved' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_channel_identities_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "inbox_conversation_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"previous_membership_id" text,
	"new_membership_id" text,
	"actor_user_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_conversation_notes" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body_text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_conversation_notes_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "inbox_notes_body_limit_check" CHECK (char_length("inbox_conversation_notes"."body_text") between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "inbox_conversation_reads" (
	"tenant_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"membership_id" text NOT NULL,
	"last_read_sequence" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_conversation_reads_tenant_id_conversation_id_membership_id_pk" PRIMARY KEY("tenant_id","conversation_id","membership_id")
);
--> statement-breakpoint
CREATE TABLE "inbox_attachments" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"message_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"declared_mime" text,
	"detected_mime" text,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_attachments_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "inbox_connections" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"channel" "inbox_channel" NOT NULL,
	"name" text NOT NULL,
	"status" "inbox_connection_status" DEFAULT 'draft' NOT NULL,
	"external_account_id" text,
	"external_identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provider_version" text,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_verified_at" timestamp,
	"last_error_code" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	CONSTRAINT "inbox_connections_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "inbox_connections_name_length_check" CHECK (char_length("inbox_connections"."name") between 2 and 120)
);
--> statement-breakpoint
CREATE TABLE "inbox_conversations" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"channel" "inbox_channel" NOT NULL,
	"external_thread_id" text NOT NULL,
	"identity_id" text,
	"contact_id" text,
	"opportunity_id" text,
	"assigned_membership_id" text,
	"status" "inbox_conversation_status" DEFAULT 'open' NOT NULL,
	"priority" "inbox_priority" DEFAULT 'normal' NOT NULL,
	"subject" text,
	"first_message_at" timestamp,
	"last_message_at" timestamp,
	"last_inbound_at" timestamp,
	"last_outbound_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_conversations_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "inbox_forms" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"public_key_hash" text NOT NULL,
	"status" "inbox_form_status" DEFAULT 'draft' NOT NULL,
	"allowed_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"consent_text" text,
	"source_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_forms_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "inbox_forms_public_key_hash_unique" UNIQUE("public_key_hash")
);
--> statement-breakpoint
CREATE TABLE "inbox_messages" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"direction" "inbox_direction" NOT NULL,
	"kind" "inbox_message_kind" NOT NULL,
	"external_message_id" text,
	"client_idempotency_id" text,
	"sender_identity_id" text,
	"sender_membership_id" text,
	"body_text" text,
	"status" "inbox_message_status" DEFAULT 'received' NOT NULL,
	"reply_to_message_id" text,
	"provider_timestamp" timestamp,
	"server_sequence" integer NOT NULL,
	"error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_messages_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "inbox_messages_body_limit_check" CHECK ("inbox_messages"."body_text" is null or char_length("inbox_messages"."body_text") <= 20000)
);
--> statement-breakpoint
CREATE TABLE "inbox_webhook_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key_hash" text NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"provider" text NOT NULL,
	"verification_secret_name" text,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_webhook_routes_public_key_hash_unique" UNIQUE("public_key_hash")
);
--> statement-breakpoint
CREATE TABLE "inbox_integration_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text,
	"receipt_id" text,
	"type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "inbox_job_status" DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"lock_owner" text,
	"locked_at" timestamp,
	"lease_expires_at" timestamp,
	"last_error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_secret_values" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"logical_name" text NOT NULL,
	"ciphertext" text NOT NULL,
	"nonce" text NOT NULL,
	"authentication_tag" text NOT NULL,
	"key_version" integer NOT NULL,
	"algorithm" text NOT NULL,
	"fingerprint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_secret_values_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "inbox_message_status_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"message_id" text NOT NULL,
	"external_event_id" text,
	"status" "inbox_message_status" NOT NULL,
	"provider_timestamp" timestamp,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_webhook_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"external_event_id" text,
	"body_ciphertext" text NOT NULL,
	"body_nonce" text NOT NULL,
	"body_authentication_tag" text NOT NULL,
	"body_hash" text NOT NULL,
	"content_type" text NOT NULL,
	"body_size" integer NOT NULL,
	"status" "inbox_receipt_status" DEFAULT 'received' NOT NULL,
	"error_code" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
 --> statement-breakpoint
CREATE UNIQUE INDEX "inbox_receipts_tenant_id_unique" ON "inbox_webhook_receipts" USING btree ("tenant_id","id");--> statement-breakpoint
ALTER TABLE "inbox_channel_identities" ADD CONSTRAINT "inbox_identities_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."inbox_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_channel_identities" ADD CONSTRAINT "inbox_identities_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversation_assignments" ADD CONSTRAINT "inbox_conversation_assignments_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversation_assignments" ADD CONSTRAINT "inbox_assignments_conversation_same_tenant_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."inbox_conversations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversation_notes" ADD CONSTRAINT "inbox_conversation_notes_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversation_notes" ADD CONSTRAINT "inbox_notes_conversation_same_tenant_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."inbox_conversations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversation_reads" ADD CONSTRAINT "inbox_reads_conversation_same_tenant_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."inbox_conversations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_attachments" ADD CONSTRAINT "inbox_attachments_message_same_tenant_fk" FOREIGN KEY ("tenant_id","message_id") REFERENCES "public"."inbox_messages"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_connections" ADD CONSTRAINT "inbox_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_connections" ADD CONSTRAINT "inbox_connections_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_connections" ADD CONSTRAINT "inbox_connections_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversations" ADD CONSTRAINT "inbox_conversations_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."inbox_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversations" ADD CONSTRAINT "inbox_conversations_identity_same_tenant_fk" FOREIGN KEY ("tenant_id","identity_id") REFERENCES "public"."inbox_channel_identities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversations" ADD CONSTRAINT "inbox_conversations_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversations" ADD CONSTRAINT "inbox_conversations_opportunity_same_tenant_fk" FOREIGN KEY ("tenant_id","opportunity_id") REFERENCES "public"."sales_opportunities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_conversations" ADD CONSTRAINT "inbox_conversations_assignee_same_tenant_fk" FOREIGN KEY ("tenant_id","assigned_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_forms" ADD CONSTRAINT "inbox_forms_source_same_tenant_fk" FOREIGN KEY ("tenant_id","source_id") REFERENCES "public"."sales_lead_sources"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_conversation_same_tenant_fk" FOREIGN KEY ("tenant_id","conversation_id") REFERENCES "public"."inbox_conversations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."inbox_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_sender_identity_same_tenant_fk" FOREIGN KEY ("tenant_id","sender_identity_id") REFERENCES "public"."inbox_channel_identities"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_sender_membership_same_tenant_fk" FOREIGN KEY ("tenant_id","sender_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_webhook_routes" ADD CONSTRAINT "inbox_webhook_routes_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."inbox_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_integration_jobs" ADD CONSTRAINT "inbox_jobs_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."inbox_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_integration_jobs" ADD CONSTRAINT "inbox_jobs_receipt_same_tenant_fk" FOREIGN KEY ("tenant_id","receipt_id") REFERENCES "public"."inbox_webhook_receipts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_secret_values" ADD CONSTRAINT "integration_secrets_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."inbox_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_message_status_events" ADD CONSTRAINT "inbox_status_events_message_same_tenant_fk" FOREIGN KEY ("tenant_id","message_id") REFERENCES "public"."inbox_messages"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_webhook_receipts" ADD CONSTRAINT "inbox_receipts_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."inbox_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_identities_connection_external_idx" ON "inbox_channel_identities" USING btree ("connection_id","external_participant_id");--> statement-breakpoint
CREATE INDEX "inbox_identities_contact_idx" ON "inbox_channel_identities" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE INDEX "inbox_attachments_message_idx" ON "inbox_attachments" USING btree ("tenant_id","message_id");--> statement-breakpoint
CREATE INDEX "inbox_connections_tenant_status_idx" ON "inbox_connections" USING btree ("tenant_id","status","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_connections_active_external_number_idx" ON "inbox_connections" USING btree ("channel","external_account_id") WHERE "inbox_connections"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_conversations_connection_thread_idx" ON "inbox_conversations" USING btree ("connection_id","external_thread_id");--> statement-breakpoint
CREATE INDEX "inbox_conversations_list_idx" ON "inbox_conversations" USING btree ("tenant_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "inbox_conversations_assignee_idx" ON "inbox_conversations" USING btree ("tenant_id","assigned_membership_id","updated_at");--> statement-breakpoint
CREATE INDEX "inbox_forms_status_idx" ON "inbox_forms" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_messages_external_idx" ON "inbox_messages" USING btree ("connection_id","external_message_id") WHERE "inbox_messages"."external_message_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_messages_client_idempotency_idx" ON "inbox_messages" USING btree ("tenant_id","client_idempotency_id") WHERE "inbox_messages"."client_idempotency_id" is not null;--> statement-breakpoint
CREATE INDEX "inbox_messages_conversation_idx" ON "inbox_messages" USING btree ("tenant_id","conversation_id","server_sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_jobs_idempotency_idx" ON "inbox_integration_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "inbox_jobs_claim_idx" ON "inbox_integration_jobs" USING btree ("status","available_at","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_secrets_connection_name_idx" ON "integration_secret_values" USING btree ("tenant_id","connection_id","logical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_status_events_external_idx" ON "inbox_message_status_events" USING btree ("message_id","external_event_id") WHERE "inbox_message_status_events"."external_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_receipts_connection_event_idx" ON "inbox_webhook_receipts" USING btree ("connection_id","external_event_id") WHERE "inbox_webhook_receipts"."external_event_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_receipts_connection_hash_idx" ON "inbox_webhook_receipts" USING btree ("connection_id","body_hash");--> statement-breakpoint
CREATE INDEX "inbox_receipts_status_idx" ON "inbox_webhook_receipts" USING btree ("status","received_at");
--> statement-breakpoint
REVOKE ALL ON TABLE "inbox_connections", "integration_secret_values", "inbox_webhook_routes", "inbox_webhook_receipts", "inbox_integration_jobs", "inbox_channel_identities", "inbox_conversations", "inbox_messages", "inbox_message_status_events", "inbox_conversation_assignments", "inbox_conversation_reads", "inbox_conversation_notes", "inbox_attachments", "inbox_forms" FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "inbox_connections", "integration_secret_values", "inbox_channel_identities", "inbox_conversations", "inbox_messages", "inbox_message_status_events", "inbox_conversation_assignments", "inbox_conversation_reads", "inbox_conversation_notes", "inbox_attachments", "inbox_forms" TO crm_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE "tenants" TO crm_worker;
--> statement-breakpoint
GRANT SELECT ON TABLE "inbox_webhook_routes" TO crm_ingress;
--> statement-breakpoint
GRANT SELECT ON TABLE "inbox_forms" TO crm_ingress;
--> statement-breakpoint
GRANT INSERT, UPDATE, SELECT ON TABLE "inbox_webhook_receipts", "inbox_integration_jobs" TO crm_ingress, crm_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "crm_contacts", "crm_contact_methods", "crm_commercial_audit_events", "sales_opportunities", "sales_pipeline_stages", "sales_pipelines", "sales_lead_sources", "sales_lost_reasons", "sales_activities", "sales_stage_history", "sales_state_history", "sales_domain_events" TO crm_worker;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'inbox_connections', 'integration_secret_values', 'inbox_webhook_receipts',
    'inbox_integration_jobs', 'inbox_channel_identities', 'inbox_conversations',
    'inbox_messages', 'inbox_message_status_events', 'inbox_conversation_assignments',
    'inbox_conversation_reads', 'inbox_conversation_notes', 'inbox_attachments', 'inbox_forms'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_runtime_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_runtime_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_runtime_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_runtime_delete', table_name);
  END LOOP;
  EXECUTE 'CREATE POLICY inbox_forms_ingress_public_select ON inbox_forms FOR SELECT TO crm_ingress USING (status = ''active'')';
  FOREACH table_name IN ARRAY ARRAY['inbox_webhook_receipts', 'inbox_integration_jobs'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_ingress, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_service_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_ingress, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_service_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_ingress, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_service_update', table_name);
  END LOOP;
END $$;
