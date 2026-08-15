CREATE OR REPLACE FUNCTION public.consume_quote_public_link(p_token_hash text)
RETURNS TABLE(tenant_id text, quote_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ UPDATE public.quote_public_links SET active = false, last_accessed_at = now() WHERE token_hash = p_token_hash AND active = true AND (expires_at IS NULL OR expires_at > now()) RETURNING tenant_id, quote_id $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.consume_quote_public_link(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.consume_quote_public_link(text) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.consume_agreement_recipient_link(p_token_hash text)
RETURNS TABLE(tenant_id text, recipient_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ UPDATE public.agreement_recipient_links SET active = false, revoked_at = now() WHERE token_hash = p_token_hash AND active = true AND expires_at > now() AND revoked_at IS NULL RETURNING tenant_id, recipient_id $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.consume_agreement_recipient_link(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.consume_agreement_recipient_link(text) TO crm_ingress;
