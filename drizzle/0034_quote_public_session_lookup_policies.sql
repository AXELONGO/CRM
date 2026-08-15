DROP POLICY IF EXISTS "quote_public_sessions_ingress_lookup" ON "quote_public_sessions";
--> statement-breakpoint
CREATE POLICY "quote_public_sessions_ingress_lookup" ON "quote_public_sessions" FOR SELECT TO crm_ingress USING (revoked_at IS NULL AND expires_at > now());
--> statement-breakpoint
DROP POLICY IF EXISTS "agreement_public_sessions_ingress_lookup" ON "agreement_public_sessions";
--> statement-breakpoint
CREATE POLICY "agreement_public_sessions_ingress_lookup" ON "agreement_public_sessions" FOR SELECT TO crm_ingress USING (revoked_at IS NULL AND expires_at > now());