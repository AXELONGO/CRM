-- A lost OTP-verification response may be retried with the same verified code.
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
    AND (
      c.status = 'pending'::public.quote_challenge_status
      OR (
        c.status = 'verified'::public.quote_challenge_status
        AND c.consumed_at IS NULL
      )
    )
  ORDER BY (c.status = 'pending'::public.quote_challenge_status) DESC, c.created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'challenge_missing'::text, NULL::text, 0;
    RETURN;
  END IF;
  IF v_challenge.status = 'verified'::public.quote_challenge_status THEN
    IF p_code_hash = v_challenge.code_hash THEN
      UPDATE public.quote_public_sessions
      SET csrf_hash = p_csrf_hash
      WHERE id = v_session.id;
      RETURN QUERY SELECT 'verified'::text, v_challenge.id, v_challenge.attempts;
      RETURN;
    END IF;
    RETURN QUERY SELECT 'already_verified'::text, v_challenge.id, v_challenge.attempts;
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
    IF v_session.otp_hash IS NOT NULL AND p_code_hash = v_session.otp_hash THEN
      UPDATE public.agreement_public_sessions
      SET csrf_hash = p_csrf_hash
      WHERE id = v_session.id;
      RETURN QUERY SELECT 'verified'::text, v_session.otp_attempts;
      RETURN;
    END IF;
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
