ALTER TABLE "quote_outbox_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_outbox_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "quote_outbox_tenant_policy" ON "quote_outbox_events" FOR ALL TO crm_runtime, crm_worker USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quote_outbox_events" TO crm_runtime, crm_worker;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.resolve_quote_public_session(p_session_hash text)
RETURNS TABLE(tenant_id text, quote_id text, session_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ SELECT tenant_id, quote_id, id FROM public.quote_public_sessions WHERE session_hash = p_session_hash AND revoked_at IS NULL AND expires_at > now() LIMIT 1 $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.resolve_quote_public_session(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_quote_public_session(text) TO crm_ingress;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.resolve_quote_public_link(p_token_hash text)
RETURNS TABLE(tenant_id text, quote_id text)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$ SELECT tenant_id, quote_id FROM public.quote_public_links WHERE token_hash = p_token_hash AND active = true AND (expires_at IS NULL OR expires_at > now()) LIMIT 1 $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.resolve_quote_public_link(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_quote_public_link(text) TO crm_ingress;
