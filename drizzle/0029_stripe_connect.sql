CREATE TYPE "public"."stripe_connection_status" AS ENUM('draft', 'authorization_pending', 'connected', 'restricted', 'payments_disabled', 'payouts_disabled', 'deauthorized', 'disconnected');--> statement-breakpoint
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
);--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_account_global_unique" ON "stripe_profiles" USING btree ("stripe_account_id");--> statement-breakpoint
ALTER TABLE "stripe_profiles" ADD CONSTRAINT "stripe_profile_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "stripe_profiles" TO crm_runtime, crm_worker;--> statement-breakpoint
ALTER TABLE "stripe_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stripe_profiles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "stripe_profiles_tenant_policy" ON "stripe_profiles" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
