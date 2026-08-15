CREATE TYPE "public"."paypal_connection_status" AS ENUM('draft', 'onboarding_pending', 'onboarding_returned', 'connected', 'restricted', 'disconnected', 'revoked');--> statement-breakpoint
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
);--> statement-breakpoint
CREATE UNIQUE INDEX "paypal_merchant_global_unique" ON "paypal_profiles" USING btree ("merchant_id");--> statement-breakpoint
ALTER TABLE "paypal_profiles" ADD CONSTRAINT "paypal_profile_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "paypal_profiles" TO crm_runtime, crm_worker;--> statement-breakpoint
ALTER TABLE "paypal_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "paypal_profiles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "paypal_profiles_tenant_policy" ON "paypal_profiles" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
