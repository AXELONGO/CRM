DROP POLICY IF EXISTS "quote_client_decisions_ingress_all" ON "quote_client_decisions";
--> statement-breakpoint
CREATE POLICY "quote_client_decisions_ingress_insert" ON "quote_client_decisions" FOR INSERT TO crm_ingress WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
REVOKE DELETE, UPDATE ON "quote_client_decisions" FROM crm_ingress;
--> statement-breakpoint
DROP POLICY IF EXISTS "quote_outbox_ingress_insert" ON "quote_outbox_events";
--> statement-breakpoint
CREATE POLICY "quote_outbox_ingress_insert" ON "quote_outbox_events" FOR INSERT TO crm_ingress WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
REVOKE ALL ON "quote_outbox_events" FROM crm_ingress;
--> statement-breakpoint
GRANT INSERT ON "quote_outbox_events" TO crm_ingress;
--> statement-breakpoint
DROP POLICY IF EXISTS "agreement_evidence_bundles_ingress_policy" ON "agreement_evidence_bundles";
--> statement-breakpoint
CREATE POLICY "agreement_evidence_bundles_ingress_insert" ON "agreement_evidence_bundles" FOR INSERT TO crm_ingress WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
REVOKE ALL ON "agreement_evidence_bundles" FROM crm_ingress;
--> statement-breakpoint
GRANT INSERT ON "agreement_evidence_bundles" TO crm_ingress;
--> statement-breakpoint
DROP POLICY IF EXISTS "agreement_outbox_ingress_insert" ON "agreement_outbox_events";
--> statement-breakpoint
CREATE POLICY "agreement_outbox_ingress_insert" ON "agreement_outbox_events" FOR INSERT TO crm_ingress WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
REVOKE ALL ON "agreement_outbox_events" FROM crm_ingress;
--> statement-breakpoint
GRANT INSERT ON "agreement_outbox_events" TO crm_ingress;
--> statement-breakpoint
DROP POLICY IF EXISTS "quotes_ingress_update" ON "quotes";
--> statement-breakpoint
DROP POLICY IF EXISTS "projects_ingress_update" ON "projects";
--> statement-breakpoint
REVOKE UPDATE ON "quotes" FROM crm_ingress;
--> statement-breakpoint
REVOKE UPDATE ON "projects" FROM crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.apply_quote_decision_status(
  p_tenant_id text,
  p_quote_id text,
  p_status text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_quote_id text;
BEGIN
  UPDATE public.quotes
     SET status = p_status::quote_status,
         updated_at = now()
   WHERE tenant_id = p_tenant_id
     AND id = p_quote_id
     AND status IN ('issued', 'viewed')
   RETURNING id INTO v_quote_id;
  RETURN v_quote_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.apply_quote_decision_status(text, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.apply_quote_decision_status(text, text, text) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reconcile_project_commercial_scope(
  p_tenant_id text,
  p_opportunity_id text,
  p_quote_id text,
  p_quote_version_id text,
  p_snapshot_hash text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_project_id text;
BEGIN
  IF p_opportunity_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.projects
     SET quote_id = p_quote_id,
         quote_version_id = p_quote_version_id,
         accepted_scope_hash = p_snapshot_hash,
         preparation_status = CASE
           WHEN template_version_id IS NOT NULL
             THEN 'ready_for_planning'::project_preparation_status
           ELSE 'awaiting_template'::project_preparation_status
         END,
         updated_at = now(),
         version = version + 1
   WHERE tenant_id = p_tenant_id
     AND opportunity_id = p_opportunity_id
     AND status = 'draft'::project_status
   RETURNING id INTO v_project_id;
  RETURN v_project_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.reconcile_project_commercial_scope(text, text, text, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.reconcile_project_commercial_scope(text, text, text, text, text) TO crm_ingress;
--> statement-breakpoint
DO $owner_policies$
DECLARE
  mig_role text := current_user;
BEGIN
  EXECUTE format($f$CREATE POLICY "quotes_owner_tenant_update" ON "quotes" FOR UPDATE TO %I USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true))$f$, mig_role);
  EXECUTE format($f$CREATE POLICY "quotes_owner_tenant_select" ON "quotes" FOR SELECT TO %I USING (tenant_id = current_setting('app.current_tenant_id', true))$f$, mig_role);
  EXECUTE format($f$CREATE POLICY "projects_owner_tenant_update" ON "projects" FOR UPDATE TO %I USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true))$f$, mig_role);
  EXECUTE format($f$CREATE POLICY "projects_owner_tenant_select" ON "projects" FOR SELECT TO %I USING (tenant_id = current_setting('app.current_tenant_id', true))$f$, mig_role);
END
$owner_policies$;