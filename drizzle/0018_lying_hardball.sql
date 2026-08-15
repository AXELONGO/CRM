ALTER TABLE "quote_versions" ADD COLUMN "pdf_key" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "pdf_sha256" text;--> statement-breakpoint
ALTER TABLE "quote_versions" ADD COLUMN "renderer_version" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "owner_membership_id" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_owner_same_tenant_fk" FOREIGN KEY ("tenant_id","owner_membership_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE no action ON UPDATE no action;
