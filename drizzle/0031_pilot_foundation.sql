CREATE POLICY "tenant_memberships_user_lookup" ON "tenant_memberships"
  FOR SELECT TO crm_runtime
  USING (
    "user_id" = nullif(current_setting('app.current_user_id', true), '')
  );
--> statement-breakpoint
CREATE POLICY "tenant_invitations_token_lookup" ON "tenant_invitations"
  FOR SELECT TO crm_runtime
  USING (
    "token_hash" = nullif(current_setting('app.invitation_token_hash', true), '')
    AND "email" = nullif(current_setting('app.invitation_email', true), '')
  );
--> statement-breakpoint
CREATE POLICY "security_audit_events_platform_bootstrap_insert" ON "security_audit_events"
  FOR INSERT TO crm_runtime
  WITH CHECK (
    "tenant_id" IS NULL
    AND "actor_user_id" = nullif(current_setting('app.current_user_id', true), '')
    AND "event_type" = 'platform.admin_bootstrapped'
    AND "target_type" = 'platform_administrator'
    AND "target_id" = "actor_user_id"
    AND "result" = 'success'
    AND EXISTS (
      SELECT 1
      FROM "platform_administrators"
      WHERE "platform_administrators"."user_id" = "security_audit_events"."actor_user_id"
    )
  );
