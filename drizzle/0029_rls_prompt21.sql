DO $$
DECLARE
  table_name text;
  protected_tables text[] := ARRAY[
    'agreement_acceptance_actions', 'agreement_drafts', 'agreement_envelopes',
    'agreement_evidence_bundles', 'agreement_external_execution_records',
    'agreement_number_sequences', 'agreement_outbox_events',
    'agreement_public_sessions', 'agreement_recipient_links', 'agreement_recipients',
    'agreement_versions', 'agreements', 'inbox_webhook_routes',
    'mercado_pago_profiles', 'oauth_authorization_attempts', 'payment_secret_values',
    'paypal_profiles', 'quote_items', 'quote_number_sequences', 'quote_public_links',
    'quote_versions', 'quotes', 'security_audit_events', 'stripe_profiles',
    'tenant_invitations', 'tenant_memberships', 'waha_session_bindings'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))',
      table_name || '_prompt21_select', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO crm_runtime, crm_worker WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))',
      table_name || '_prompt21_insert', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))',
      table_name || '_prompt21_update', table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO crm_runtime, crm_worker USING (tenant_id = current_setting(''app.current_tenant_id'', true))',
      table_name || '_prompt21_delete', table_name
    );
  END LOOP;
END
$$;
