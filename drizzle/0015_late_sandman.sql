CREATE TABLE "quote_public_sessions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"session_hash" text NOT NULL,
	"csrf_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_public_sessions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "quote_public_sessions" ADD CONSTRAINT "quote_public_sessions_quote_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_id") REFERENCES "public"."quotes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_public_sessions_hash_unique" ON "quote_public_sessions" USING btree ("session_hash");
--> statement-breakpoint
ALTER TABLE "quote_public_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_public_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "quote_public_sessions_tenant_policy" ON "quote_public_sessions" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_public_sessions_ingress_policy" ON "quote_public_sessions" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quote_public_sessions" TO crm_runtime, crm_worker, crm_ingress;
