-- PostgreSQL 17 exposes sha256(bytea) natively; provide the text digest used
-- by recipient fingerprints without relying on the optional pgcrypto extension.
CREATE OR REPLACE FUNCTION public.digest(p_data text, p_type text)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF lower(p_type) <> 'sha256' THEN
    RAISE EXCEPTION 'OTP_DIGEST_ALGORITHM_UNSUPPORTED';
  END IF;
  RETURN pg_catalog.sha256(convert_to(p_data, 'UTF8'));
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.digest(text, text) FROM PUBLIC;
