DROP FUNCTION IF EXISTS public.consume_quote_public_link(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.consume_agreement_recipient_link(text);
--> statement-breakpoint
GRANT UPDATE ON "quote_public_links" TO crm_ingress;
--> statement-breakpoint
CREATE POLICY "quote_public_links_ingress_consume" ON "quote_public_links" FOR UPDATE TO crm_ingress USING (active AND (expires_at IS NULL OR expires_at > now())) WITH CHECK (active = false);
--> statement-breakpoint
GRANT UPDATE ON "agreement_recipient_links" TO crm_ingress;
--> statement-breakpoint
CREATE POLICY "agreement_recipient_links_ingress_consume" ON "agreement_recipient_links" FOR UPDATE TO crm_ingress USING (active AND expires_at > now() AND revoked_at IS NULL) WITH CHECK (active = false AND revoked_at IS NOT NULL);