GRANT SELECT ON "sales_activities", "sales_domain_events", "sales_lead_sources", "sales_lost_reasons", "sales_opportunities", "sales_opportunity_participants", "sales_pipeline_stages", "sales_pipelines", "sales_stage_history", "sales_state_history" TO crm_worker;
--> statement-breakpoint
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'sales_activities',
    'sales_domain_events',
    'sales_lead_sources',
    'sales_lost_reasons',
    'sales_opportunities',
    'sales_opportunity_participants',
    'sales_pipeline_stages',
    'sales_pipelines',
    'sales_stage_history',
    'sales_state_history'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_worker_select', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_worker_select', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_worker_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_worker_insert', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_worker_update', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_worker_update', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_worker_delete', table_name);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))', table_name || '_worker_delete', table_name);
  END LOOP;
END
$$;