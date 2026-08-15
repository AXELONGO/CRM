CREATE TYPE "public"."manual_payment_status" AS ENUM('pending_review', 'approved', 'rejected', 'voided');--> statement-breakpoint
CREATE TYPE "public"."payment_adjustment_kind" AS ENUM('partial_refund', 'full_refund', 'chargeback', 'reversal', 'correction');--> statement-breakpoint
CREATE TYPE "public"."payment_exception_status" AS ENUM('open', 'investigating', 'resolved', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."payment_exception_type" AS ENUM('amount_mismatch', 'currency_mismatch', 'overpayment', 'manual_duplicate_suspected', 'refund_or_chargeback', 'stale_processing');--> statement-breakpoint
CREATE TABLE "manual_payment_submissions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"installment_id" text,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference_masked" text,
	"institution" text,
	"note" text,
	"evidence_key" text,
	"status" "manual_payment_status" DEFAULT 'pending_review' NOT NULL,
	"submitted_by_membership_id" text NOT NULL,
	"reviewed_by_membership_id" text,
	"decision_reason" text,
	"idempotency_key" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "manual_payment_submissions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "manual_payment_submissions_amount_check" CHECK ("manual_payment_submissions"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_adjustments" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"kind" "payment_adjustment_kind" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"external_adjustment_id" text,
	"reason" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_adjustments_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "payment_adjustments_amount_check" CHECK ("payment_adjustments"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"request_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"external_checkout_id" text,
	"external_payment_id" text,
	"status" "payment_attempt_status" DEFAULT 'created' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_attempts_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "payment_attempts_amount_check" CHECK ("payment_attempts"."amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_exceptions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"type" "payment_exception_type" NOT NULL,
	"status" "payment_exception_status" DEFAULT 'open' NOT NULL,
	"payment_id" text,
	"request_id" text,
	"expected_snapshot" jsonb NOT NULL,
	"observed_snapshot" jsonb NOT NULL,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "payment_exceptions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "manual_payment_submissions" ADD CONSTRAINT "manual_payment_submissions_plan_same_tenant_fk" FOREIGN KEY ("tenant_id","plan_id") REFERENCES "public"."receivable_plans"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_submissions" ADD CONSTRAINT "manual_payment_submissions_installment_same_tenant_fk" FOREIGN KEY ("tenant_id","installment_id") REFERENCES "public"."receivable_installments"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_submissions" ADD CONSTRAINT "manual_payment_submissions_submitter_same_tenant_fk" FOREIGN KEY ("tenant_id","submitted_by_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment_submissions" ADD CONSTRAINT "manual_payment_submissions_reviewer_same_tenant_fk" FOREIGN KEY ("tenant_id","reviewed_by_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_adjustments" ADD CONSTRAINT "payment_adjustments_payment_same_tenant_fk" FOREIGN KEY ("tenant_id","payment_id") REFERENCES "public"."payment_records"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_request_same_tenant_fk" FOREIGN KEY ("tenant_id","request_id") REFERENCES "public"."payment_requests"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_connection_same_tenant_fk" FOREIGN KEY ("tenant_id","connection_id") REFERENCES "public"."payment_connections"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_exceptions" ADD CONSTRAINT "payment_exceptions_payment_same_tenant_fk" FOREIGN KEY ("tenant_id","payment_id") REFERENCES "public"."payment_records"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_exceptions" ADD CONSTRAINT "payment_exceptions_request_same_tenant_fk" FOREIGN KEY ("tenant_id","request_id") REFERENCES "public"."payment_requests"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manual_payment_submissions_idempotency_unique" ON "manual_payment_submissions" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_adjustments_external_unique" ON "payment_adjustments" USING btree ("tenant_id","external_adjustment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_idempotency_unique" ON "payment_attempts" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_exceptions_open_idx" ON "payment_exceptions" USING btree ("tenant_id","status","created_at");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "manual_payment_submissions", "payment_adjustments", "payment_attempts", "payment_exceptions" TO crm_runtime, crm_worker;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'manual_payment_submissions', 'payment_adjustments',
    'payment_attempts', 'payment_exceptions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_tenant_delete', table_name);
  END LOOP;
END $$;
