ALTER TABLE "agreement_public_sessions" ADD COLUMN "otp_hash" text;--> statement-breakpoint
ALTER TABLE "agreement_public_sessions" ADD COLUMN "otp_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agreement_public_sessions" ADD COLUMN "otp_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agreement_public_sessions" ADD COLUMN "otp_used_at" timestamp with time zone;