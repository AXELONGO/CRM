ALTER TABLE "quote_versions" ADD COLUMN "snapshot_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_versions" ALTER COLUMN "snapshot_hash" DROP DEFAULT;
