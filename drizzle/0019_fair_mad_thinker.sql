CREATE TABLE "quote_outbox_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_outbox_events" ADD CONSTRAINT "quote_outbox_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_outbox_tenant_created_idx" ON "quote_outbox_events" USING btree ("tenant_id","created_at");
--> statement-breakpoint
ALTER TABLE "quote_outbox_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_outbox_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "quote_outbox_tenant_policy" ON "quote_outbox_events" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quote_outbox_events" TO crm_runtime, crm_worker;
