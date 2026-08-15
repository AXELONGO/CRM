CREATE TYPE "public"."deposit_policy" AS ENUM('none', 'exact_amount', 'percentage', 'first_installment');--> statement-breakpoint
CREATE TYPE "public"."deposit_status" AS ENUM('not_required', 'pending', 'satisfied', 'reversed', 'exception');--> statement-breakpoint
CREATE TYPE "public"."receivable_installment_kind" AS ENUM('deposit', 'milestone', 'hourly_period', 'retainer_period', 'final', 'other');--> statement-breakpoint
CREATE TYPE "public"."receivable_installment_status" AS ENUM('scheduled', 'open', 'partially_paid', 'paid', 'past_due', 'cancelled', 'exception');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('created', 'pending', 'succeeded', 'failed', 'cancelled', 'reversed', 'exception');--> statement-breakpoint
CREATE TYPE "public"."payment_connection_status" AS ENUM('draft', 'authorization_pending', 'verifying', 'active', 'degraded', 'blocked', 'revoked', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."payment_environment" AS ENUM('sandbox', 'live');--> statement-breakpoint
CREATE TYPE "public"."payment_event_kind" AS ENUM('payment_confirmed', 'refund_observed', 'chargeback_observed', 'reversal_observed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('manual_transfer', 'cash', 'check', 'fake_checkout', 'provider');--> statement-breakpoint
CREATE TYPE "public"."payment_commercial_model" AS ENUM('fixed', 'hourly', 'retainer', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'mercadopago', 'paypal', 'manual', 'fake');--> statement-breakpoint
CREATE TYPE "public"."payment_record_status" AS ENUM('pending_review', 'confirmed', 'reversed', 'rejected', 'exception');--> statement-breakpoint
CREATE TYPE "public"."payment_request_status" AS ENUM('draft', 'creating', 'open', 'processing', 'paid', 'expired', 'cancelled', 'failed', 'exception', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."payment_source_kind" AS ENUM('accepted_quote_version', 'executed_agreement_version');--> statement-breakpoint
CREATE TYPE "public"."receivable_plan_status" AS ENUM('draft', 'open', 'partially_paid', 'completed', 'cancelled', 'exception');--> statement-breakpoint
CREATE TABLE "deposit_requirements" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"policy" "deposit_policy" NOT NULL,
	"required_amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"percentage" integer,
	"qualifying_installment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "deposit_status" DEFAULT 'pending' NOT NULL,
	"satisfied_amount_minor" bigint DEFAULT 0 NOT NULL,
	"satisfied_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "deposit_requirements_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "deposit_requirements_percentage_check" CHECK ("deposit_requirements"."percentage" is null or "deposit_requirements"."percentage" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"installment_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "payment_allocations_amount_check" CHECK ("payment_allocations"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_connections" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"environment" "payment_environment" NOT NULL,
	"display_name" text NOT NULL,
	"external_account_id" text,
	"external_account_display" text,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "payment_connection_status" DEFAULT 'draft' NOT NULL,
	"secret_reference" text,
	"connected_by_membership_id" text,
	"last_verified_at" timestamp with time zone,
	"last_error_code" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_connections_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "payment_outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_provider_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"event_key" text NOT NULL,
	"kind" "payment_event_kind" NOT NULL,
	"digest" text NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"request_id" text,
	"provider" "payment_provider" NOT NULL,
	"method" "payment_method" NOT NULL,
	"external_payment_id" text,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_record_status" DEFAULT 'pending_review' NOT NULL,
	"evidence_key" text,
	"reference_masked" text,
	"note" text,
	"created_by_user_id" text NOT NULL,
	"reviewed_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "payment_records_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "payment_records_amount_check" CHECK ("payment_records"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_requests" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"installment_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"public_token_hash" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"description_snapshot" text NOT NULL,
	"external_reference" text NOT NULL,
	"status" "payment_request_status" DEFAULT 'draft' NOT NULL,
	"checkout_external_id" text,
	"hosted_url" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_requests_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "payment_requests_amount_check" CHECK ("payment_requests"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "receivable_installments" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"label" text NOT NULL,
	"due_date" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"kind" "receivable_installment_kind" NOT NULL,
	"expected_percentage" integer,
	"status" "receivable_installment_status" DEFAULT 'scheduled' NOT NULL,
	"paid_amount_minor" bigint DEFAULT 0 NOT NULL,
	"paid_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_installments_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "receivable_installments_amount_check" CHECK ("receivable_installments"."amount_minor" > 0 and "receivable_installments"."paid_amount_minor" >= 0),
	CONSTRAINT "receivable_installments_currency_check" CHECK ("receivable_installments"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "receivable_plans" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"customer_account_id" text,
	"billing_contact_id" text,
	"source_kind" "payment_source_kind" NOT NULL,
	"source_id" text NOT NULL,
	"source_version_id" text NOT NULL,
	"source_hash" text NOT NULL,
	"source_number" text,
	"commercial_model" "payment_commercial_model" NOT NULL,
	"currency" text NOT NULL,
	"expected_total_minor" bigint NOT NULL,
	"scheduled_total_minor" bigint NOT NULL,
	"status" "receivable_plan_status" DEFAULT 'draft' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"opened_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_plans_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "receivable_plans_currency_check" CHECK ("receivable_plans"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "receivable_plans_amount_check" CHECK ("receivable_plans"."expected_total_minor" >= 0 and "receivable_plans"."scheduled_total_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "deposit_requirements" ADD CONSTRAINT "deposit_requirements_plan_same_tenant_fk" FOREIGN KEY ("tenant_id","plan_id") REFERENCES "public"."receivable_plans"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_same_tenant_fk" FOREIGN KEY ("tenant_id","payment_id") REFERENCES "public"."payment_records"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_installment_same_tenant_fk" FOREIGN KEY ("tenant_id","installment_id") REFERENCES "public"."receivable_installments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_connections" ADD CONSTRAINT "payment_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_outbox_events" ADD CONSTRAINT "payment_outbox_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_plan_same_tenant_fk" FOREIGN KEY ("tenant_id","plan_id") REFERENCES "public"."receivable_plans"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_request_same_tenant_fk" FOREIGN KEY ("tenant_id","request_id") REFERENCES "public"."payment_requests"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_plan_same_tenant_fk" FOREIGN KEY ("tenant_id","plan_id") REFERENCES "public"."receivable_plans"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_installment_same_tenant_fk" FOREIGN KEY ("tenant_id","installment_id") REFERENCES "public"."receivable_installments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_installments" ADD CONSTRAINT "receivable_installments_plan_same_tenant_fk" FOREIGN KEY ("tenant_id","plan_id") REFERENCES "public"."receivable_plans"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_plans" ADD CONSTRAINT "receivable_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_plans" ADD CONSTRAINT "receivable_plans_account_same_tenant_fk" FOREIGN KEY ("tenant_id","customer_account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_plans" ADD CONSTRAINT "receivable_plans_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","billing_contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_plans" ADD CONSTRAINT "receivable_plans_membership_same_tenant_fk" FOREIGN KEY ("tenant_id","created_by_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_requirements_plan_unique" ON "deposit_requirements" USING btree ("tenant_id","plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_connections_provider_environment_unique" ON "payment_connections" USING btree ("tenant_id","provider","environment");--> statement-breakpoint
CREATE INDEX "payment_outbox_tenant_created_idx" ON "payment_outbox_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_events_connection_key_unique" ON "payment_provider_events" USING btree ("connection_id","event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_records_provider_external_unique" ON "payment_records" USING btree ("tenant_id","provider","external_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_requests_token_unique" ON "payment_requests" USING btree ("public_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_requests_idempotency_unique" ON "payment_requests" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_requests_external_reference_unique" ON "payment_requests" USING btree ("tenant_id","external_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "receivable_installments_sequence_unique" ON "receivable_installments" USING btree ("tenant_id","plan_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "receivable_plans_source_version_unique" ON "receivable_plans" USING btree ("tenant_id","source_kind","source_version_id");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "deposit_requirements", "payment_allocations", "payment_connections", "payment_outbox_events", "payment_provider_events", "payment_records", "payment_requests", "receivable_installments", "receivable_plans" TO crm_runtime, crm_worker;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'deposit_requirements', 'payment_allocations', 'payment_connections',
    'payment_outbox_events', 'payment_provider_events', 'payment_records',
    'payment_requests', 'receivable_installments', 'receivable_plans'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END $$;
