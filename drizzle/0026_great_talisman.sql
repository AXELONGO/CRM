CREATE TYPE "public"."integration_connection_status" AS ENUM('draft', 'configuring', 'pending_verification', 'verified', 'active', 'degraded', 'disabled', 'revoked', 'failed');--> statement-breakpoint
CREATE TYPE "public"."integration_provider_event_status" AS ENUM('received', 'processing', 'processed', 'ignored', 'retry', 'dead');--> statement-breakpoint
CREATE TYPE "public"."messaging_selection_state" AS ENUM('none', 'pending_cutover', 'active', 'paused');--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"provider_code" text NOT NULL,
	"display_name" text NOT NULL,
	"ownership_mode" text NOT NULL,
	"status" "integration_connection_status" DEFAULT 'draft' NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"external_refs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_verified_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_connections_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "integration_provider_events" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"dedup_key" text NOT NULL,
	"event_type" text NOT NULL,
	"body_hash" text NOT NULL,
	"status" "integration_provider_event_status" DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "integration_provider_events_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "meta_whatsapp_configs" (
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"graph_api_version" text NOT NULL,
	"app_id" text NOT NULL,
	"waba_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"display_phone_snapshot" text,
	"verified_name_snapshot" text,
	"public_connection_key_hash" text NOT NULL,
	"config_version" integer DEFAULT 1 NOT NULL,
	"webhook_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_whatsapp_configs_tenant_id_connection_id_pk" PRIMARY KEY("tenant_id","connection_id")
);
--> statement-breakpoint
CREATE TABLE "meta_whatsapp_templates" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"external_template_id" text NOT NULL,
	"name" text NOT NULL,
	"language" text NOT NULL,
	"status" text NOT NULL,
	"components_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_whatsapp_templates_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "tenant_messaging_provider_selections" (
	"tenant_id" text NOT NULL,
	"capability" text NOT NULL,
	"active_connection_id" text,
	"state" "messaging_selection_state" DEFAULT 'none' NOT NULL,
	"previous_connection_id" text,
	"version" integer DEFAULT 1 NOT NULL,
	"activated_at" timestamp with time zone,
	"activated_by_user_id" text,
	CONSTRAINT "tenant_messaging_provider_selections_tenant_id_capability_pk" PRIMARY KEY("tenant_id","capability")
);
--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connection_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_provider_events" ADD CONSTRAINT "integration_event_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."integration_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_whatsapp_configs" ADD CONSTRAINT "meta_whatsapp_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."integration_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_whatsapp_templates" ADD CONSTRAINT "meta_template_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."integration_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_messaging_provider_selections" ADD CONSTRAINT "messaging_selection_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_messaging_provider_selections" ADD CONSTRAINT "messaging_selection_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","active_connection_id") REFERENCES "public"."integration_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_connections_provider_status_idx" ON "integration_connections" USING btree ("tenant_id","provider_code","status");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_provider_event_dedup_unique" ON "integration_provider_events" USING btree ("tenant_id","connection_id","dedup_key");--> statement-breakpoint
CREATE INDEX "integration_provider_event_status_idx" ON "integration_provider_events" USING btree ("tenant_id","status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_whatsapp_phone_active_unique" ON "meta_whatsapp_configs" USING btree ("phone_number_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_whatsapp_public_key_unique" ON "meta_whatsapp_configs" USING btree ("public_connection_key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_template_external_unique" ON "meta_whatsapp_templates" USING btree ("tenant_id","connection_id","external_template_id","language");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "integration_connections", "integration_provider_events", "meta_whatsapp_configs", "meta_whatsapp_templates", "tenant_messaging_provider_selections" TO crm_runtime, crm_worker;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'integration_connections', 'integration_provider_events', 'meta_whatsapp_configs',
    'meta_whatsapp_templates', 'tenant_messaging_provider_selections'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END $$;
