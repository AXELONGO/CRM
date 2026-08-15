DROP POLICY IF EXISTS "test_ingress_consume_true" ON "quote_public_links";
--> statement-breakpoint
DROP POLICY IF EXISTS "quote_public_links_ingress_consume" ON "quote_public_links";
--> statement-breakpoint
DROP POLICY IF EXISTS "quote_public_links_ingress_lookup" ON "quote_public_links";
--> statement-breakpoint
CREATE POLICY "quote_public_links_ingress_consume" ON "quote_public_links" FOR UPDATE TO crm_ingress USING (active AND (expires_at IS NULL OR expires_at > now())) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "quote_public_links_ingress_lookup" ON "quote_public_links" FOR SELECT TO crm_ingress USING ((expires_at IS NULL OR expires_at > now()));
--> statement-breakpoint
DROP POLICY IF EXISTS "agreement_recipient_links_ingress_consume" ON "agreement_recipient_links";
--> statement-breakpoint
DROP POLICY IF EXISTS "agreement_recipient_links_ingress_lookup" ON "agreement_recipient_links";
--> statement-breakpoint
CREATE POLICY "agreement_recipient_links_ingress_consume" ON "agreement_recipient_links" FOR UPDATE TO crm_ingress USING (active AND expires_at > now() AND revoked_at IS NULL) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY "agreement_recipient_links_ingress_lookup" ON "agreement_recipient_links" FOR SELECT TO crm_ingress USING (expires_at > now());