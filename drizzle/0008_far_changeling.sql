ALTER TABLE "inbox_webhook_routes" ADD COLUMN "verifier_ciphertext" text;--> statement-breakpoint
ALTER TABLE "inbox_webhook_routes" ADD COLUMN "verifier_nonce" text;--> statement-breakpoint
ALTER TABLE "inbox_webhook_routes" ADD COLUMN "verifier_authentication_tag" text;--> statement-breakpoint
ALTER TABLE "inbox_webhook_routes" ADD COLUMN "verifier_key_version" integer;