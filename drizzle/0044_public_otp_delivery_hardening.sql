-- Public OTP delivery is durable, recipient-bound, and rate limited per session.
--> statement-breakpoint
ALTER TABLE "quote_public_sessions"
  ADD COLUMN "otp_locked_at" timestamp with time zone,
  ADD COLUMN "otp_last_sent_at" timestamp with time zone,
  ADD COLUMN "otp_request_window_started_at" timestamp with time zone,
  ADD COLUMN "otp_request_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_email_challenges" ADD COLUMN "locked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "agreement_public_sessions"
  ADD COLUMN "otp_locked_at" timestamp with time zone,
  ADD COLUMN "otp_last_sent_at" timestamp with time zone,
  ADD COLUMN "otp_resend_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "otp_request_window_started_at" timestamp with time zone,
  ADD COLUMN "otp_request_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TYPE "public_otp_delivery_kind" AS ENUM ('quote-otp', 'agreement-otp');
--> statement-breakpoint
CREATE TYPE "public_otp_delivery_status" AS ENUM ('pending', 'processing', 'sent', 'retry', 'dead', 'cancelled');
--> statement-breakpoint
CREATE TABLE "public_otp_delivery_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "kind" "public_otp_delivery_kind" NOT NULL,
  "subject_id" text NOT NULL,
  "recipient" text NOT NULL,
  "recipient_name" text NOT NULL,
  "code_ciphertext" text NOT NULL,
  "code_nonce" text NOT NULL,
  "code_authentication_tag" text NOT NULL,
  "key_version" integer NOT NULL,
  "idempotency_key" text NOT NULL,
  "status" "public_otp_delivery_status" DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "lock_owner" text,
  "lease_expires_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "last_error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "public_otp_delivery_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "public_otp_delivery_max_attempts_check" CHECK ("max_attempts" BETWEEN 1 AND 8)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "public_otp_delivery_idempotency_unique" ON "public_otp_delivery_jobs" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "public_otp_delivery_claim_idx" ON "public_otp_delivery_jobs" USING btree ("tenant_id", "status", "available_at");
--> statement-breakpoint
ALTER TABLE "public_otp_delivery_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public_otp_delivery_jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON "public_otp_delivery_jobs" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON "public_otp_delivery_jobs" FROM crm_ingress;
--> statement-breakpoint
GRANT SELECT, UPDATE ON "public_otp_delivery_jobs" TO crm_worker;
--> statement-breakpoint
CREATE POLICY "public_otp_delivery_worker_select" ON "public_otp_delivery_jobs"
  FOR SELECT TO crm_worker
  USING (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
CREATE POLICY "public_otp_delivery_worker_update" ON "public_otp_delivery_jobs"
  FOR UPDATE TO crm_worker
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
--> statement-breakpoint
DO $owner$
DECLARE
  mig text := current_user;
BEGIN
  EXECUTE format('CREATE POLICY "public_otp_delivery_owner_select" ON "public_otp_delivery_jobs" FOR SELECT TO %I USING (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "public_otp_delivery_owner_insert" ON "public_otp_delivery_jobs" FOR INSERT TO %I WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "quote_otp_contacts_owner_select" ON "crm_contacts" FOR SELECT TO %I USING (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "quote_otp_contact_methods_owner_select" ON "crm_contact_methods" FOR SELECT TO %I USING (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "agreement_otp_sessions_owner_select" ON "agreement_public_sessions" FOR SELECT TO %I USING (revoked_at IS NULL AND expires_at > now())', mig);
  EXECUTE format('CREATE POLICY "agreement_otp_sessions_owner_update" ON "agreement_public_sessions" FOR UPDATE TO %I USING (tenant_id = current_setting(''app.current_tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
  EXECUTE format('CREATE POLICY "agreement_otp_recipients_owner_select" ON "agreement_recipients" FOR SELECT TO %I USING (tenant_id = current_setting(''app.current_tenant_id'', true))', mig);
END
$owner$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.request_quote_otp_delivery(
  p_session_hash text,
  p_challenge_id text,
  p_delivery_id text,
  p_code_hash text,
  p_code_ciphertext text,
  p_code_nonce text,
  p_code_authentication_tag text,
  p_key_version integer
)
RETURNS TABLE(result text, challenge_id text, is_fresh boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.quote_public_sessions%ROWTYPE;
  v_challenge public.quote_email_challenges%ROWTYPE;
  v_delivery public.public_otp_delivery_jobs%ROWTYPE;
  v_recipient text;
  v_recipient_name text;
  v_fingerprint text;
  v_window_start timestamptz;
  v_window_count integer;
  v_challenge_id text;
  v_is_fresh boolean := false;
BEGIN
  SELECT * INTO v_session
  FROM public.quote_public_sessions s
  WHERE s.session_hash = p_session_hash
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN QUERY SELECT 'session_invalid'::text, NULL::text, false;
    RETURN;
  END IF;

  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  IF v_session.otp_locked_at IS NOT NULL THEN
    RETURN QUERY SELECT 'locked'::text, NULL::text, false;
    RETURN;
  END IF;
  IF v_session.otp_last_sent_at IS NOT NULL
    AND v_session.otp_last_sent_at > now() - interval '60 seconds' THEN
    RETURN QUERY SELECT 'cooldown'::text, NULL::text, false;
    RETURN;
  END IF;
  IF v_session.otp_request_window_started_at IS NOT NULL
    AND v_session.otp_request_window_started_at > now() - interval '15 minutes'
    AND v_session.otp_request_count >= 3 THEN
    RETURN QUERY SELECT 'rate_limited'::text, NULL::text, false;
    RETURN;
  END IF;

  SELECT cm.normalized_value, c.display_name
  INTO v_recipient, v_recipient_name
  FROM public.quotes q
  JOIN public.crm_contacts c
    ON c.tenant_id = q.tenant_id AND c.id = q.contact_id
  JOIN public.crm_contact_methods cm
    ON cm.tenant_id = c.tenant_id AND cm.contact_id = c.id
  WHERE q.tenant_id = v_session.tenant_id
    AND q.id = v_session.quote_id
    AND c.status = 'active'
    AND c.do_not_contact = false
    AND cm.type = 'email'
    AND cm.status = 'active'
    AND cm.is_primary = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'recipient_missing'::text, NULL::text, false;
    RETURN;
  END IF;
  v_fingerprint := encode(public.digest(v_recipient, 'sha256'), 'hex');

  SELECT * INTO v_challenge
  FROM public.quote_email_challenges c
  WHERE c.session_id = v_session.id
    AND c.status = 'pending'::public.quote_challenge_status
  ORDER BY c.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_challenge.expires_at > now() THEN
    IF v_challenge.resend_count >= 2 THEN
      RETURN QUERY SELECT 'rate_limited'::text, v_challenge.id, false;
      RETURN;
    END IF;
    v_challenge_id := v_challenge.id;
    SELECT * INTO v_delivery
    FROM public.public_otp_delivery_jobs d
    WHERE d.kind = 'quote-otp'::public.public_otp_delivery_kind
      AND d.subject_id = v_challenge.id
    ORDER BY d.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.public_otp_delivery_jobs (
        id, tenant_id, kind, subject_id, recipient, recipient_name,
        code_ciphertext, code_nonce, code_authentication_tag, key_version,
        idempotency_key
      ) VALUES (
        p_delivery_id, v_session.tenant_id, 'quote-otp'::public.public_otp_delivery_kind,
        v_challenge.id, v_recipient, v_recipient_name,
        v_delivery.code_ciphertext, v_delivery.code_nonce,
        v_delivery.code_authentication_tag, v_delivery.key_version,
        p_delivery_id
      );
      UPDATE public.quote_email_challenges
      SET resend_count = resend_count + 1,
          last_sent_at = now(),
          email_fingerprint = v_fingerprint
      WHERE id = v_challenge.id AND session_id = v_session.id;
    ELSE
      IF char_length(p_code_hash) <> 64 OR p_key_version < 1
        OR p_code_ciphertext = '' OR p_code_nonce = '' OR p_code_authentication_tag = '' THEN
        RAISE EXCEPTION 'OTP_DELIVERY_PAYLOAD_INVALID';
      END IF;
      UPDATE public.quote_email_challenges
      SET code_hash = p_code_hash,
          expires_at = now() + interval '10 minutes',
          resend_count = resend_count + 1,
          last_sent_at = now(),
          email_fingerprint = v_fingerprint
      WHERE id = v_challenge.id AND session_id = v_session.id;
      INSERT INTO public.public_otp_delivery_jobs (
        id, tenant_id, kind, subject_id, recipient, recipient_name,
        code_ciphertext, code_nonce, code_authentication_tag, key_version,
        idempotency_key
      ) VALUES (
        p_delivery_id, v_session.tenant_id, 'quote-otp'::public.public_otp_delivery_kind,
        v_challenge.id, v_recipient, v_recipient_name,
        p_code_ciphertext, p_code_nonce, p_code_authentication_tag, p_key_version,
        p_delivery_id
      );
      v_is_fresh := true;
    END IF;
  ELSE
    UPDATE public.quote_email_challenges
    SET status = 'expired'::public.quote_challenge_status
    WHERE session_id = v_session.id
      AND status = 'pending'::public.quote_challenge_status;
    IF char_length(p_code_hash) <> 64 OR p_key_version < 1
      OR p_code_ciphertext = '' OR p_code_nonce = '' OR p_code_authentication_tag = '' THEN
      RAISE EXCEPTION 'OTP_DELIVERY_PAYLOAD_INVALID';
    END IF;
    INSERT INTO public.quote_email_challenges (
      id, tenant_id, session_id, email_fingerprint, code_hash, status,
      expires_at, attempts, resend_count, last_sent_at
    ) VALUES (
      p_challenge_id, v_session.tenant_id, v_session.id, v_fingerprint,
      p_code_hash, 'pending'::public.quote_challenge_status,
      now() + interval '10 minutes', 0, 0, now()
    );
    INSERT INTO public.public_otp_delivery_jobs (
      id, tenant_id, kind, subject_id, recipient, recipient_name,
      code_ciphertext, code_nonce, code_authentication_tag, key_version,
      idempotency_key
    ) VALUES (
      p_delivery_id, v_session.tenant_id, 'quote-otp'::public.public_otp_delivery_kind,
      p_challenge_id, v_recipient, v_recipient_name,
      p_code_ciphertext, p_code_nonce, p_code_authentication_tag, p_key_version,
      p_delivery_id
    );
    v_challenge_id := p_challenge_id;
    v_is_fresh := true;
  END IF;

  IF v_session.otp_request_window_started_at IS NULL
    OR v_session.otp_request_window_started_at <= now() - interval '15 minutes' THEN
    v_window_start := now();
    v_window_count := 1;
  ELSE
    v_window_start := v_session.otp_request_window_started_at;
    v_window_count := v_session.otp_request_count + 1;
  END IF;
  UPDATE public.quote_public_sessions
  SET otp_last_sent_at = now(),
      otp_request_window_started_at = v_window_start,
      otp_request_count = v_window_count
  WHERE id = v_session.id;

  RETURN QUERY SELECT 'queued'::text, v_challenge_id, v_is_fresh;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.request_quote_otp_delivery(text, text, text, text, text, text, text, integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.request_quote_otp_delivery(text, text, text, text, text, text, text, integer) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.verify_quote_otp_attempt(
  p_session_hash text,
  p_code_hash text,
  p_csrf_hash text
)
RETURNS TABLE(result text, challenge_id text, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.quote_public_sessions%ROWTYPE;
  v_challenge public.quote_email_challenges%ROWTYPE;
  v_attempts integer;
BEGIN
  SELECT * INTO v_session
  FROM public.quote_public_sessions s
  WHERE s.session_hash = p_session_hash
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN QUERY SELECT 'session_invalid'::text, NULL::text, 0;
    RETURN;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  IF v_session.otp_locked_at IS NOT NULL THEN
    RETURN QUERY SELECT 'locked'::text, NULL::text, 5;
    RETURN;
  END IF;

  SELECT * INTO v_challenge
  FROM public.quote_email_challenges c
  WHERE c.session_id = v_session.id
    AND c.status = 'pending'::public.quote_challenge_status
  ORDER BY c.created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'challenge_missing'::text, NULL::text, 0;
    RETURN;
  END IF;
  IF v_challenge.expires_at <= now() THEN
    UPDATE public.quote_email_challenges
    SET status = 'expired'::public.quote_challenge_status
    WHERE id = v_challenge.id AND session_id = v_session.id;
    RETURN QUERY SELECT 'expired'::text, v_challenge.id, v_challenge.attempts;
    RETURN;
  END IF;

  v_attempts := v_challenge.attempts + 1;
  IF p_code_hash = v_challenge.code_hash THEN
    UPDATE public.quote_email_challenges
    SET attempts = v_attempts,
        status = 'verified'::public.quote_challenge_status,
        verified_at = now()
    WHERE id = v_challenge.id AND session_id = v_session.id;
    UPDATE public.quote_public_sessions
    SET csrf_hash = p_csrf_hash
    WHERE id = v_session.id;
    RETURN QUERY SELECT 'verified'::text, v_challenge.id, v_attempts;
    RETURN;
  END IF;

  UPDATE public.quote_email_challenges
  SET attempts = v_attempts,
      status = CASE
        WHEN v_attempts >= 5 THEN 'locked'::public.quote_challenge_status
        ELSE 'pending'::public.quote_challenge_status
      END,
      locked_at = CASE WHEN v_attempts >= 5 THEN now() ELSE locked_at END
  WHERE id = v_challenge.id AND session_id = v_session.id;
  IF v_attempts >= 5 THEN
    UPDATE public.quote_public_sessions
    SET otp_locked_at = now()
    WHERE id = v_session.id;
    RETURN QUERY SELECT 'locked'::text, v_challenge.id, v_attempts;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'invalid'::text, v_challenge.id, v_attempts;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.verify_quote_otp_attempt(text, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.verify_quote_otp_attempt(text, text, text) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.request_agreement_otp_delivery(
  p_session_hash text,
  p_delivery_id text,
  p_code_hash text,
  p_code_ciphertext text,
  p_code_nonce text,
  p_code_authentication_tag text,
  p_key_version integer
)
RETURNS TABLE(result text, is_fresh boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.agreement_public_sessions%ROWTYPE;
  v_delivery public.public_otp_delivery_jobs%ROWTYPE;
  v_recipient text;
  v_recipient_name text;
  v_window_start timestamptz;
  v_window_count integer;
  v_is_fresh boolean := false;
BEGIN
  SELECT * INTO v_session
  FROM public.agreement_public_sessions s
  WHERE s.session_hash = p_session_hash
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN QUERY SELECT 'session_invalid'::text, false;
    RETURN;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  IF v_session.verified_at IS NOT NULL THEN
    RETURN QUERY SELECT 'verified'::text, false;
    RETURN;
  END IF;
  IF v_session.otp_locked_at IS NOT NULL OR v_session.otp_attempts >= 5 THEN
    UPDATE public.agreement_public_sessions
    SET otp_locked_at = coalesce(otp_locked_at, now())
    WHERE id = v_session.id;
    RETURN QUERY SELECT 'locked'::text, false;
    RETURN;
  END IF;
  IF v_session.otp_last_sent_at IS NOT NULL
    AND v_session.otp_last_sent_at > now() - interval '60 seconds' THEN
    RETURN QUERY SELECT 'cooldown'::text, false;
    RETURN;
  END IF;
  IF v_session.otp_request_window_started_at IS NOT NULL
    AND v_session.otp_request_window_started_at > now() - interval '15 minutes'
    AND v_session.otp_request_count >= 3 THEN
    RETURN QUERY SELECT 'rate_limited'::text, false;
    RETURN;
  END IF;

  SELECT r.email_snapshot, r.name_snapshot
  INTO v_recipient, v_recipient_name
  FROM public.agreement_recipients r
  WHERE r.tenant_id = v_session.tenant_id
    AND r.id = v_session.recipient_id
    AND r.status IN ('available'::public.agreement_recipient_status, 'viewed'::public.agreement_recipient_status)
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'recipient_missing'::text, false;
    RETURN;
  END IF;

  IF v_session.otp_hash IS NOT NULL
    AND v_session.otp_expires_at IS NOT NULL
    AND v_session.otp_expires_at > now()
    AND v_session.otp_used_at IS NULL THEN
    IF v_session.otp_resend_count >= 2 THEN
      RETURN QUERY SELECT 'rate_limited'::text, false;
      RETURN;
    END IF;
    SELECT * INTO v_delivery
    FROM public.public_otp_delivery_jobs d
    WHERE d.kind = 'agreement-otp'::public.public_otp_delivery_kind
      AND d.subject_id = v_session.id
    ORDER BY d.created_at DESC
    LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.public_otp_delivery_jobs (
        id, tenant_id, kind, subject_id, recipient, recipient_name,
        code_ciphertext, code_nonce, code_authentication_tag, key_version,
        idempotency_key
      ) VALUES (
        p_delivery_id, v_session.tenant_id, 'agreement-otp'::public.public_otp_delivery_kind,
        v_session.id, v_recipient, v_recipient_name,
        v_delivery.code_ciphertext, v_delivery.code_nonce,
        v_delivery.code_authentication_tag, v_delivery.key_version,
        p_delivery_id
      );
    ELSE
      IF char_length(p_code_hash) <> 64 OR p_key_version < 1
        OR p_code_ciphertext = '' OR p_code_nonce = '' OR p_code_authentication_tag = '' THEN
        RAISE EXCEPTION 'OTP_DELIVERY_PAYLOAD_INVALID';
      END IF;
      UPDATE public.agreement_public_sessions
      SET otp_hash = p_code_hash,
          otp_expires_at = now() + interval '10 minutes'
      WHERE id = v_session.id;
      INSERT INTO public.public_otp_delivery_jobs (
        id, tenant_id, kind, subject_id, recipient, recipient_name,
        code_ciphertext, code_nonce, code_authentication_tag, key_version,
        idempotency_key
      ) VALUES (
        p_delivery_id, v_session.tenant_id, 'agreement-otp'::public.public_otp_delivery_kind,
        v_session.id, v_recipient, v_recipient_name,
        p_code_ciphertext, p_code_nonce, p_code_authentication_tag, p_key_version,
        p_delivery_id
      );
      v_is_fresh := true;
    END IF;
    UPDATE public.agreement_public_sessions
    SET otp_resend_count = otp_resend_count + 1
    WHERE id = v_session.id;
  ELSE
    IF char_length(p_code_hash) <> 64 OR p_key_version < 1
      OR p_code_ciphertext = '' OR p_code_nonce = '' OR p_code_authentication_tag = '' THEN
      RAISE EXCEPTION 'OTP_DELIVERY_PAYLOAD_INVALID';
    END IF;
    UPDATE public.agreement_public_sessions
    SET otp_hash = p_code_hash,
        otp_expires_at = now() + interval '10 minutes',
        otp_used_at = NULL,
        otp_resend_count = 0
    WHERE id = v_session.id;
    INSERT INTO public.public_otp_delivery_jobs (
      id, tenant_id, kind, subject_id, recipient, recipient_name,
      code_ciphertext, code_nonce, code_authentication_tag, key_version,
      idempotency_key
    ) VALUES (
      p_delivery_id, v_session.tenant_id, 'agreement-otp'::public.public_otp_delivery_kind,
      v_session.id, v_recipient, v_recipient_name,
      p_code_ciphertext, p_code_nonce, p_code_authentication_tag, p_key_version,
      p_delivery_id
    );
    v_is_fresh := true;
  END IF;

  IF v_session.otp_request_window_started_at IS NULL
    OR v_session.otp_request_window_started_at <= now() - interval '15 minutes' THEN
    v_window_start := now();
    v_window_count := 1;
  ELSE
    v_window_start := v_session.otp_request_window_started_at;
    v_window_count := v_session.otp_request_count + 1;
  END IF;
  UPDATE public.agreement_public_sessions
  SET otp_last_sent_at = now(),
      otp_request_window_started_at = v_window_start,
      otp_request_count = v_window_count
  WHERE id = v_session.id;

  RETURN QUERY SELECT 'queued'::text, v_is_fresh;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.request_agreement_otp_delivery(text, text, text, text, text, text, integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.request_agreement_otp_delivery(text, text, text, text, text, text, integer) TO crm_ingress;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.verify_agreement_otp_attempt(
  p_session_hash text,
  p_code_hash text,
  p_csrf_hash text
)
RETURNS TABLE(result text, attempts integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.agreement_public_sessions%ROWTYPE;
  v_attempts integer;
BEGIN
  SELECT * INTO v_session
  FROM public.agreement_public_sessions s
  WHERE s.session_hash = p_session_hash
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= now() THEN
    RETURN QUERY SELECT 'session_invalid'::text, 0;
    RETURN;
  END IF;
  PERFORM set_config('app.current_tenant_id', v_session.tenant_id, true);
  IF v_session.verified_at IS NOT NULL OR v_session.otp_used_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_verified'::text, v_session.otp_attempts;
    RETURN;
  END IF;
  IF v_session.otp_locked_at IS NOT NULL OR v_session.otp_attempts >= 5 THEN
    UPDATE public.agreement_public_sessions
    SET otp_locked_at = coalesce(otp_locked_at, now())
    WHERE id = v_session.id;
    RETURN QUERY SELECT 'locked'::text, v_session.otp_attempts;
    RETURN;
  END IF;
  IF v_session.otp_hash IS NULL
    OR v_session.otp_expires_at IS NULL
    OR v_session.otp_expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, v_session.otp_attempts;
    RETURN;
  END IF;

  v_attempts := v_session.otp_attempts + 1;
  IF p_code_hash = v_session.otp_hash THEN
    UPDATE public.agreement_public_sessions
    SET otp_attempts = v_attempts,
        verified_at = now(),
        otp_used_at = now(),
        csrf_hash = p_csrf_hash
    WHERE id = v_session.id;
    RETURN QUERY SELECT 'verified'::text, v_attempts;
    RETURN;
  END IF;

  UPDATE public.agreement_public_sessions
  SET otp_attempts = v_attempts,
      otp_locked_at = CASE WHEN v_attempts >= 5 THEN now() ELSE otp_locked_at END
  WHERE id = v_session.id;
  IF v_attempts >= 5 THEN
    RETURN QUERY SELECT 'locked'::text, v_attempts;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'invalid'::text, v_attempts;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.verify_agreement_otp_attempt(text, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.verify_agreement_otp_attempt(text, text, text) TO crm_ingress;
