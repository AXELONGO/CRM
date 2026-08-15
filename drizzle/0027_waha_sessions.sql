CREATE TYPE "public"."waha_instance_status" AS ENUM('draft', 'healthy', 'degraded', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."waha_session_state" AS ENUM('unprovisioned', 'stopped', 'starting', 'qr_required', 'pairing_required', 'passkey_required', 'authenticated', 'working', 'degraded', 'failed', 'stopping', 'logged_out', 'revoked', 'unknown');--> statement-breakpoint
CREATE TABLE "waha_instances" (
 "id" text PRIMARY KEY NOT NULL,
 "display_name" text NOT NULL,
 "base_url" text NOT NULL,
 "environment" text NOT NULL,
 "status" "waha_instance_status" DEFAULT 'draft' NOT NULL,
 "image_version" text NOT NULL,
 "image_digest" text,
 "engine" text NOT NULL,
 "namespace" text NOT NULL,
 "admin_secret_ref" text NOT NULL,
 "network_mode" text NOT NULL,
 "session_storage_type" text NOT NULL,
 "media_storage_type" text NOT NULL,
 "capacity_limit" integer DEFAULT 10 NOT NULL,
 "current_sessions" integer DEFAULT 0 NOT NULL,
 "health_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "last_checked_at" timestamp with time zone,
 "version" integer DEFAULT 1 NOT NULL,
 "created_by_user_id" text,
 "updated_by_user_id" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "waha_instances_environment_status_idx" ON "waha_instances" USING btree ("environment", "status");--> statement-breakpoint
CREATE TABLE "waha_session_bindings" (
 "id" text NOT NULL,
 "tenant_id" text NOT NULL,
 "connection_id" text NOT NULL,
 "instance_id" text NOT NULL,
 "session_name" text NOT NULL,
 "engine" text NOT NULL,
 "state" "waha_session_state" DEFAULT 'unprovisioned' NOT NULL,
 "provider_account_id_snapshot" text,
 "masked_phone_snapshot" text,
 "push_name_snapshot" text,
 "session_key_ref" text,
 "media_key_ref" text,
 "webhook_hmac_secret_ref" text,
 "public_connection_key_hash" text NOT NULL,
 "risk_accepted_at" timestamp with time zone,
 "started_at" timestamp with time zone,
 "authenticated_at" timestamp with time zone,
 "working_at" timestamp with time zone,
 "stopped_at" timestamp with time zone,
 "failed_at" timestamp with time zone,
 "logged_out_at" timestamp with time zone,
 "last_event_at" timestamp with time zone,
 "version" integer DEFAULT 1 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "waha_session_bindings_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);--> statement-breakpoint
CREATE UNIQUE INDEX "waha_binding_connection_unique" ON "waha_session_bindings" USING btree ("tenant_id","connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waha_binding_instance_session_unique" ON "waha_session_bindings" USING btree ("instance_id","session_name");--> statement-breakpoint
CREATE UNIQUE INDEX "waha_binding_public_key_unique" ON "waha_session_bindings" USING btree ("public_connection_key_hash");--> statement-breakpoint
CREATE INDEX "waha_binding_tenant_state_idx" ON "waha_session_bindings" USING btree ("tenant_id","state");--> statement-breakpoint
ALTER TABLE "waha_session_bindings" ADD CONSTRAINT "waha_binding_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waha_session_bindings" ADD CONSTRAINT "waha_binding_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."integration_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waha_session_bindings" ADD CONSTRAINT "waha_binding_instance_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."waha_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "waha_instances", "waha_session_bindings" TO crm_runtime, crm_worker;--> statement-breakpoint
ALTER TABLE "waha_session_bindings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "waha_session_bindings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "waha_binding_tenant_policy" ON "waha_session_bindings" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
INSERT INTO "waha_instances" ("id", "display_name", "base_url", "environment", "status", "image_version", "image_digest", "engine", "namespace", "admin_secret_ref", "network_mode", "session_storage_type", "media_storage_type", "capacity_limit")
VALUES ('fake-waha-local', 'WAHA local simulation', 'http://waha.invalid', 'test', 'healthy', '2026.6.1-fake', NULL, 'NOWEB', 'crm-fake', 'platform/waha/admin', 'fake', 'ephemeral-test-only', 'ephemeral-test-only', 100)
ON CONFLICT ("id") DO NOTHING;
