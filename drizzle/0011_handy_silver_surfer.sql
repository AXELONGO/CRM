CREATE TYPE "public"."quote_discount_type" AS ENUM('none', 'percent', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'issued', 'accepted', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"position" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" text NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"discount_type" "quote_discount_type" DEFAULT 'none' NOT NULL,
	"discount_value" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" bigint DEFAULT 0 NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"discount_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_items_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "quote_items_position_check" CHECK ("quote_items"."position" > 0),
	CONSTRAINT "quote_items_price_check" CHECK ("quote_items"."unit_price_minor" >= 0 and "quote_items"."total_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quote_number_sequences" (
	"tenant_id" text NOT NULL,
	"prefix" text DEFAULT 'COT' NOT NULL,
	"next_value" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_number_sequences_tenant_id_pk" PRIMARY KEY("tenant_id"),
	CONSTRAINT "quote_number_sequences_next_value_check" CHECK ("quote_number_sequences"."next_value" > 0)
);
--> statement-breakpoint
CREATE TABLE "quote_public_links" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"last_accessed_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_public_links_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "quote_versions" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" text NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_versions_tenant_id_id_pk" PRIMARY KEY("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"number" text,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"currency" text NOT NULL,
	"account_id" text,
	"contact_id" text,
	"opportunity_id" text,
	"expires_at" timestamp with time zone,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"updated_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_tenant_id_id_pk" PRIMARY KEY("tenant_id","id"),
	CONSTRAINT "quotes_currency_check" CHECK ("quotes"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "quotes_title_check" CHECK (char_length("quotes"."title") between 2 and 200),
	CONSTRAINT "quotes_amounts_check" CHECK ("quotes"."total_minor" >= 0 and "quotes"."subtotal_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_id") REFERENCES "public"."quotes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_number_sequences" ADD CONSTRAINT "quote_number_sequences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_public_links" ADD CONSTRAINT "quote_public_links_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_public_links" ADD CONSTRAINT "quote_public_links_quote_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_id") REFERENCES "public"."quotes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_same_tenant_fk" FOREIGN KEY ("tenant_id","quote_id") REFERENCES "public"."quotes"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_account_same_tenant_fk" FOREIGN KEY ("tenant_id","account_id") REFERENCES "public"."crm_accounts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contact_same_tenant_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."crm_contacts"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_items_position_unique" ON "quote_items" USING btree ("tenant_id","quote_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_public_links_token_hash_unique" ON "quote_public_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "quote_public_links_lookup_idx" ON "quote_public_links" USING btree ("token_hash","active");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_versions_number_unique" ON "quote_versions" USING btree ("tenant_id","quote_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_number_unique" ON "quotes" USING btree ("tenant_id","number");--> statement-breakpoint
CREATE INDEX "quotes_tenant_status_idx" ON "quotes" USING btree ("tenant_id","status","updated_at");
--> statement-breakpoint
ALTER TABLE "quote_number_sequences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_public_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "quote_number_sequences_tenant_policy" ON "quote_number_sequences" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quotes_tenant_policy" ON "quotes" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_items_tenant_policy" ON "quote_items" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_versions_tenant_policy" ON "quote_versions" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_public_links_tenant_policy" ON "quote_public_links" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
GRANT SELECT ON "quote_public_links", "quotes", "quote_items" TO crm_ingress;
--> statement-breakpoint
CREATE POLICY "quote_public_links_ingress_lookup" ON "quote_public_links" FOR SELECT TO crm_ingress USING (active AND (expires_at IS NULL OR expires_at > now()));
--> statement-breakpoint
CREATE POLICY "quotes_ingress_select" ON "quotes" FOR SELECT TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_items_ingress_select" ON "quote_items" FOR SELECT TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true));
