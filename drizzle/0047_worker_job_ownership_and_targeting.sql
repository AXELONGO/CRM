-- Persist the exact outbound message and give crm_worker only the inbox access it needs.
ALTER TABLE "inbox_integration_jobs" ADD COLUMN "message_id" text;
--> statement-breakpoint
UPDATE "inbox_integration_jobs" AS job
SET "message_id" = message."id"
FROM "inbox_messages" AS message
WHERE job."type" = 'send_message'
  AND job."message_id" IS NULL
  AND job."tenant_id" = message."tenant_id"
  AND job."idempotency_key" = 'send:' || job."tenant_id" || ':' || message."id";
--> statement-breakpoint
ALTER TABLE "inbox_integration_jobs"
  ADD CONSTRAINT "inbox_jobs_message_same_tenant_fk"
  FOREIGN KEY ("tenant_id", "message_id")
  REFERENCES "public"."inbox_messages"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "inbox_jobs_message_idx" ON "inbox_integration_jobs" ("tenant_id", "message_id")
  WHERE "message_id" IS NOT NULL;
--> statement-breakpoint
GRANT SELECT ON TABLE "inbox_connections", "integration_secret_values" TO crm_worker;
--> statement-breakpoint
GRANT SELECT, UPDATE ON TABLE "inbox_webhook_receipts" TO crm_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "inbox_integration_jobs" TO crm_worker;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "inbox_channel_identities", "inbox_message_status_events" TO crm_worker;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE "inbox_conversations", "inbox_messages" TO crm_worker;
--> statement-breakpoint
REVOKE INSERT, DELETE ON TABLE "integration_provider_events" FROM crm_worker;
--> statement-breakpoint
GRANT SELECT, UPDATE ON TABLE "integration_provider_events" TO crm_worker;
