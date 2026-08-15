CREATE TYPE "public"."mercado_pago_connection_status" AS ENUM('draft', 'authorization_pending', 'connected', 'degraded', 'reauthorization_required', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."oauth_attempt_result" AS ENUM('pending', 'succeeded', 'cancelled', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."paypal_connection_status" AS ENUM('draft', 'onboarding_pending', 'onboarding_returned', 'connected', 'restricted', 'disconnected', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."stripe_connection_status" AS ENUM('draft', 'authorization_pending', 'connected', 'restricted', 'payments_disabled', 'payouts_disabled', 'deauthorized', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."waha_instance_status" AS ENUM('draft', 'healthy', 'degraded', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."waha_session_state" AS ENUM('unprovisioned', 'stopped', 'starting', 'qr_required', 'pairing_required', 'passkey_required', 'authenticated', 'working', 'degraded', 'failed', 'stopping', 'logged_out', 'revoked', 'unknown');--> statement-breakpoint
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
);
--> statement-breakpoint
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
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "paypal_profiles" (
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"environment" text NOT NULL,
	"merchant_id" text,
	"email_masked" text,
	"country_code" text,
	"product" text,
	"payments_receivable" boolean,
	"consent_status" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "paypal_connection_status" DEFAULT 'draft' NOT NULL,
	"onboarding_action_ref" text,
	"last_health_check_at" timestamp with time zone,
	"last_webhook_at" timestamp with time zone,
	"last_reconciled_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paypal_profiles_tenant_id_connection_id_pk" PRIMARY KEY("tenant_id","connection_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_profiles" (
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"environment" text NOT NULL,
	"stripe_account_id" text,
	"oauth_scope" text,
	"country" text,
	"default_currency" text,
	"business_name_masked" text,
	"details_submitted" boolean,
	"charges_enabled" boolean,
	"payouts_enabled" boolean,
	"card_payments_capability" text,
	"requirements_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "stripe_connection_status" DEFAULT 'draft' NOT NULL,
	"connected_at" timestamp with time zone,
	"last_account_sync_at" timestamp with time zone,
	"last_webhook_at" timestamp with time zone,
	"last_reconciled_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_profiles_tenant_id_connection_id_pk" PRIMARY KEY("tenant_id","connection_id")
);
--> statement-breakpoint
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
);
--> statement-breakpoint
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
);
--> statement-breakpoint
ALTER TABLE "mercado_pago_profiles" ADD CONSTRAINT "mercado_pago_profile_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_attempts" ADD CONSTRAINT "oauth_attempt_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_secret_values" ADD CONSTRAINT "payment_secrets_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paypal_profiles" ADD CONSTRAINT "paypal_profile_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_profiles" ADD CONSTRAINT "stripe_profile_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waha_session_bindings" ADD CONSTRAINT "waha_binding_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waha_session_bindings" ADD CONSTRAINT "waha_binding_connection_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."integration_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waha_session_bindings" ADD CONSTRAINT "waha_binding_instance_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."waha_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mercado_pago_seller_active_unique" ON "mercado_pago_profiles" USING btree ("environment","seller_user_id") WHERE "mercado_pago_profiles"."status" in ('connected', 'degraded', 'reauthorization_required');--> statement-breakpoint
CREATE INDEX "oauth_attempts_tenant_expiry_idx" ON "oauth_authorization_attempts" USING btree ("tenant_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_secrets_connection_name_unique" ON "payment_secret_values" USING btree ("tenant_id","connection_id","logical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_merchant_global_unique" ON "paypal_profiles" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_account_global_unique" ON "stripe_profiles" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE INDEX "waha_instances_environment_status_idx" ON "waha_instances" USING btree ("environment","status");--> statement-breakpoint
CREATE UNIQUE INDEX "waha_binding_connection_unique" ON "waha_session_bindings" USING btree ("tenant_id","connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waha_binding_instance_session_unique" ON "waha_session_bindings" USING btree ("instance_id","session_name");--> statement-breakpoint
CREATE UNIQUE INDEX "waha_binding_public_key_unique" ON "waha_session_bindings" USING btree ("public_connection_key_hash");--> statement-breakpoint
CREATE INDEX "waha_binding_tenant_state_idx" ON "waha_session_bindings" USING btree ("tenant_id","state");