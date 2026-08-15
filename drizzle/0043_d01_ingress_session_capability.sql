-- 0043 D-01 corrective: public session/challenge operations are capabilities.
-- SECURITY DEFINER functions must derive tenant/quote from a verified session
-- hash, never from caller-supplied tenant_id; crm_ingress keeps SELECT-only on
-- capability tables and every write goes through a function.
--> statement-breakpoint
DROP POLICY IF EXISTS "quote_public_sessions_ingress_policy" ON "quote_public_sessions";
--> statement-breakpoint
DROP POLICY IF EXISTS "quote_public_sessions_ingress_lookup" ON "quote_public_sessions";
--> statement-breakpoint
CREATE POLICY "quote_public_sessions_ingress_lookup" ON "quote_public_sessions" FOR SELECT TO crm_ingress USING (revoked_at IS NULL AND expires_at > now());
--> statement-breakpoint
DROP POLICY IF EXISTS "quote_challenges_ingress_policy" ON "quote_email_challenges";
--> statement-breakpoint
CREATE POLICY "quote_email_challenges_ingress_select" ON "quote_email_challenges" FOR SELECT TO crm_ingress USING (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "quote_public_sessions" FROM crm_ingress;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON "quote_email_challenges" FROM crm_ingress;
--> statement-breakpoint
DO $owner$
DECLARE
  mig text := current_user;
BEGIN
  EXECUTE format('CREATE POLICY "quote_public_sessions_owner_select" ON "quote_public_sessions" FOR SELECT TO %I USING (revoked_at IS NULL AND expires_at > now())', mig);
  EXECUTE format('CREATE POLICY "quote_public_sessions_owner_insert" ON "quote_public_sessions" FOR INSERT TO %I WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "quote_public_sessions_owner_update" ON "quote_public_sessions" FOR UPDATE TO %I USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "quote_email_challenges_owner_select" ON "quote_email_challenges" FOR SELECT TO %I USING (true)', mig);
  EXECUTE format('CREATE POLICY "quote_email_challenges_owner_insert" ON "quote_email_challenges" FOR INSERT TO %I WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "quote_email_challenges_owner_update" ON "quote_email_challenges" FOR UPDATE TO %I USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "quote_public_links_owner_select" ON "quote_public_links" FOR SELECT TO %I USING (true)', mig);
  EXECUTE format('CREATE POLICY "quote_public_links_owner_consume" ON "quote_public_links" FOR UPDATE TO %I USING (active AND (expires_at IS NULL OR expires_at > now())) WITH CHECK (active = false)', mig);
  EXECUTE format('CREATE POLICY "quote_versions_owner_select" ON "quote_versions" FOR SELECT TO %I USING (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
END
$owner$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.exchange_quote_link_and_create_session(
  p_token_hash text,
  p_session_hash text,
  p_csrf_hash text,
  p_expires_at timestamptz
)
RETURNS TABLE(tenant_id text, quote_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id text;
  v_quote_id text;
BEGIN
  UPDATE public.quote_public_links AS qpl
     SET active = false, last_accessed_at = now()
   WHERE qpl.token_hash = p_token_hash
     AND qpl.active = true
     AND (qpl.expires_at IS NULL OR qpl.expires_at > now())
   RETURNING qpl.tenant_id, qpl.quote_id INTO v_tenant_id, v_quote_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_tenant_id, true);
  INSERT INTO public.quote_public_sessions (id, tenant_id, quote_id, session_hash, csrf_hash, expires_at)
  VALUES (gen_random_uuid()::text, v_tenant_id, v_quote_id, p_session_hash, p_csrf_hash, p_expires_at);
  RETURN QUERY SELECT v_tenant_id, v_quote_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.exchange_quote_link_and_create_session(text, text, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.exchange_quote_link_and_create_session(text, text, text, timestamptz) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.create_quote_email_challenge(
  p_session_hash text,
  p_email_fingerprint text,
  p_code_hash text,
  p_expires_at timestamptz
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.quote_public_sessions%ROWTYPE;
  v_challenge_id text;
BEGIN
  SELECT * INTO v_session FROM public.quote_public_sessions WHERE session_hash = p_session_hash LIMIT 1;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  v_challenge_id := gen_random_uuid()::text;
  INSERT INTO public.quote_email_challenges (id, tenant_id, session_id, email_fingerprint, code_hash, status, expires_at, last_sent_at)
  VALUES (v_challenge_id, v_session.tenant_id, v_session.id, p_email_fingerprint, p_code_hash, 'pending'::public.quote_challenge_status, p_expires_at, now());
  RETURN v_challenge_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.create_quote_email_challenge(text, text, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_quote_email_challenge(text, text, text, timestamptz) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.record_quote_otp_attempt(
  p_session_hash text,
  p_challenge_id text,
  p_attempts integer,
  p_status text,
  p_verified_at timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.quote_public_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.quote_public_sessions WHERE session_hash = p_session_hash LIMIT 1;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  UPDATE public.quote_email_challenges
     SET attempts = p_attempts,
         status = p_status::public.quote_challenge_status,
         verified_at = p_verified_at
   WHERE id = p_challenge_id AND session_id = v_session.id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.record_quote_otp_attempt(text, text, integer, text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.record_quote_otp_attempt(text, text, integer, text, timestamptz) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.rotate_quote_session_csrf(
  p_session_hash text,
  p_csrf_hash text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.quote_public_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.quote_public_sessions WHERE session_hash = p_session_hash LIMIT 1;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  UPDATE public.quote_public_sessions
     SET csrf_hash = p_csrf_hash
   WHERE id = v_session.id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.rotate_quote_session_csrf(text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.rotate_quote_session_csrf(text, text) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.consume_quote_email_challenge(
  p_session_hash text,
  p_challenge_id text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.quote_public_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.quote_public_sessions WHERE session_hash = p_session_hash LIMIT 1;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  UPDATE public.quote_email_challenges
     SET status = 'consumed'::public.quote_challenge_status, consumed_at = now()
   WHERE id = p_challenge_id AND session_id = v_session.id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.consume_quote_email_challenge(text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.consume_quote_email_challenge(text, text) TO crm_ingress;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.apply_quote_decision_status(text, text, text);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.apply_quote_decision_status(p_session_hash text, p_status text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.quote_public_sessions%ROWTYPE;
  v_challenge_verified boolean;
  v_quote_id text;
BEGIN
  IF p_status NOT IN ('accepted', 'rejected', 'changes_requested') THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_session FROM public.quote_public_sessions WHERE session_hash = p_session_hash LIMIT 1;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN NULL;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.quote_email_challenges c
     WHERE c.session_id = v_session.id AND c.status = 'verified'::public.quote_challenge_status AND c.consumed_at IS NULL
  ) INTO v_challenge_verified;
  IF NOT v_challenge_verified THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  UPDATE public.quotes
     SET status = p_status::public.quote_status,
         updated_at = now()
   WHERE tenant_id = v_session.tenant_id
     AND id = v_session.quote_id
     AND status IN ('issued'::public.quote_status, 'viewed'::public.quote_status)
   RETURNING id INTO v_quote_id;
  RETURN v_quote_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.apply_quote_decision_status(text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.apply_quote_decision_status(text, text) TO crm_ingress;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.reconcile_project_commercial_scope(text, text, text, text, text);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reconcile_project_commercial_scope(
  p_session_hash text,
  p_quote_version_id text,
  p_snapshot_hash text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.quote_public_sessions%ROWTYPE;
  v_opportunity_id text;
  v_version_exists boolean;
  v_project_id text;
BEGIN
  SELECT * INTO v_session FROM public.quote_public_sessions WHERE session_hash = p_session_hash LIMIT 1;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN NULL;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  SELECT EXISTS (
    SELECT 1 FROM public.quote_versions v
     WHERE v.tenant_id = v_session.tenant_id
       AND v.quote_id = v_session.quote_id
       AND v.id = p_quote_version_id
       AND v.snapshot_hash = p_snapshot_hash
  ) INTO v_version_exists;
  IF NOT v_version_exists THEN
    RETURN NULL;
  END IF;
  SELECT opportunity_id INTO v_opportunity_id
    FROM public.quotes
   WHERE tenant_id = v_session.tenant_id AND id = v_session.quote_id;
  IF v_opportunity_id IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.projects
     SET quote_id = v_session.quote_id,
         quote_version_id = p_quote_version_id,
         accepted_scope_hash = p_snapshot_hash,
         preparation_status = CASE
           WHEN template_version_id IS NOT NULL
             THEN 'ready_for_planning'::public.project_preparation_status
           ELSE 'awaiting_template'::public.project_preparation_status
         END,
         updated_at = now(),
         version = version + 1
   WHERE tenant_id = v_session.tenant_id
     AND opportunity_id = v_opportunity_id
     AND status = 'draft'::public.project_status
   RETURNING id INTO v_project_id;
  RETURN v_project_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.reconcile_project_commercial_scope(text, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.reconcile_project_commercial_scope(text, text, text) TO crm_ingress;