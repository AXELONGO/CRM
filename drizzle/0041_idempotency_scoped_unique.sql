DROP INDEX IF EXISTS "quote_decisions_idempotency_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "quote_decisions_idempotency_unique" ON "quote_client_decisions" USING btree ("tenant_id","quote_id","session_id","idempotency_key");
--> statement-breakpoint
DROP INDEX IF EXISTS "agreement_actions_idempotency_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_actions_idempotency_unique" ON "agreement_acceptance_actions" USING btree ("tenant_id","envelope_id","recipient_id","idempotency_key");