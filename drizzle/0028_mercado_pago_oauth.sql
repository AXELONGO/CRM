CREATE TYPE "public"."mercado_pago_connection_status" AS ENUM('draft', 'authorization_pending', 'connected', 'degraded', 'reauthorization_required', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."oauth_attempt_result" AS ENUM('pending', 'succeeded', 'cancelled', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "mercado_pago_profiles" (
 "tenant_id" text NOT NULL,
 "connection_id" text NOT NULL,
 "environment" text NOT NULL,
 "seller_user_id" text,
 "country_code" text,
 "site_id" text,
 "nickname_masked" text,
 "email_masked" text,
 "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
 "status" "mercado_pago_connection_status" DEFAULT 'draft' NOT NULL,
 "access_token_secret_ref" text,
 "refresh_token_secret_ref" text,
 "access_token_expires_at" timestamp with time zone,
 "token_version" integer DEFAULT 1 NOT NULL,
 "last_health_check_at" timestamp with time zone,
 "last_webhook_at" timestamp with time zone,
 "last_reconciled_at" timestamp with time zone,
 "authorized_at" timestamp with time zone,
 "version" integer DEFAULT 1 NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "mercado_pago_profiles_tenant_id_connection_id_pk" PRIMARY KEY("tenant_id","connection_id")
);--> statement-breakpoint
CREATE UNIQUE INDEX "mercado_pago_seller_active_unique" ON "mercado_pago_profiles" USING btree ("environment","seller_user_id") WHERE "status" in ('connected', 'degraded', 'reauthorization_required');--> statement-breakpoint
ALTER TABLE "mercado_pago_profiles" ADD CONSTRAINT "mercado_pago_profile_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id");--> statement-breakpoint
CREATE TABLE "payment_secret_values" (
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
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "payment_secret_values_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);--> statement-breakpoint
CREATE UNIQUE INDEX "payment_secrets_connection_name_unique" ON "payment_secret_values" USING btree ("tenant_id","connection_id","logical_name");--> statement-breakpoint
ALTER TABLE "payment_secret_values" ADD CONSTRAINT "payment_secrets_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id");--> statement-breakpoint
CREATE TABLE "oauth_authorization_attempts" (
 "id" text PRIMARY KEY NOT NULL,
 "tenant_id" text NOT NULL,
 "provider" text NOT NULL,
 "connection_id" text NOT NULL,
 "initiated_by_user_id" text NOT NULL,
 "state_hash" text NOT NULL,
 "code_verifier_ciphertext" text,
 "code_verifier_nonce" text,
 "code_verifier_tag" text,
 "code_verifier_key_version" integer,
 "redirect_uri_version" text NOT NULL,
 "requested_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "expires_at" timestamp with time zone NOT NULL,
 "consumed_at" timestamp with time zone,
 "result" "oauth_attempt_result" DEFAULT 'pending' NOT NULL,
 CONSTRAINT "oauth_authorization_attempts_state_hash_unique" UNIQUE("state_hash")
);--> statement-breakpoint
CREATE INDEX "oauth_attempts_tenant_expiry_idx" ON "oauth_authorization_attempts" USING btree ("tenant_id","expires_at");--> statement-breakpoint
ALTER TABLE "oauth_authorization_attempts" ADD CONSTRAINT "oauth_attempt_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "mercado_pago_profiles", "payment_secret_values", "oauth_authorization_attempts" TO crm_runtime, crm_worker;--> statement-breakpoint
ALTER TABLE "mercado_pago_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mercado_pago_profiles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "mercado_pago_profiles_tenant_policy" ON "mercado_pago_profiles" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
ALTER TABLE "payment_secret_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_secret_values" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payment_secret_values_tenant_policy" ON "payment_secret_values" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
ALTER TABLE "oauth_authorization_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_authorization_attempts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "oauth_authorization_attempts_tenant_policy" ON "oauth_authorization_attempts" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
