GRANT UPDATE ON "quotes" TO crm_ingress;
--> statement-breakpoint
CREATE POLICY "quotes_ingress_update" ON "quotes" FOR UPDATE TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
CREATE POLICY "quote_client_decisions_ingress_all" ON "quote_client_decisions" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quote_outbox_events" TO crm_ingress;
--> statement-breakpoint
CREATE POLICY "quote_outbox_ingress_insert" ON "quote_outbox_events" FOR ALL TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
GRANT UPDATE ON "projects" TO crm_ingress;
--> statement-breakpoint
CREATE POLICY "projects_ingress_update" ON "projects" FOR UPDATE TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));