GRANT SELECT, INSERT, UPDATE, DELETE ON "quote_number_sequences", "quotes", "quote_items", "quote_versions", "quote_public_links" TO crm_runtime, crm_worker;
--> statement-breakpoint
GRANT SELECT ON "quote_versions" TO crm_ingress;
--> statement-breakpoint
CREATE POLICY "quote_versions_ingress_select" ON "quote_versions" FOR SELECT TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
GRANT SELECT ON "tenants" TO crm_ingress;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "agreement_number_sequences", "agreements", "agreement_drafts", "agreement_versions", "agreement_envelopes", "agreement_recipients", "agreement_recipient_links", "agreement_public_sessions", "agreement_acceptance_actions", "agreement_evidence_bundles", "agreement_external_execution_records", "agreement_outbox_events" TO crm_runtime, crm_worker, crm_ingress;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "portal_invitations", "portal_accesses", "portal_access_project_scopes" TO crm_ingress;
--> statement-breakpoint
GRANT SELECT ON "projects" TO crm_ingress;
--> statement-breakpoint
CREATE POLICY "portal_invitations_ingress_policy" ON "portal_invitations" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
CREATE POLICY "portal_accesses_ingress_policy" ON "portal_accesses" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
CREATE POLICY "portal_access_project_scopes_ingress_policy" ON "portal_access_project_scopes" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
CREATE POLICY "projects_ingress_select" ON "projects" FOR SELECT TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true));