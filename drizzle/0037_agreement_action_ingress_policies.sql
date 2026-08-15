CREATE POLICY "agreement_evidence_bundles_ingress_policy" ON "agreement_evidence_bundles" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
CREATE POLICY "agreement_outbox_ingress_insert" ON "agreement_outbox_events" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
