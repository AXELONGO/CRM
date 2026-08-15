# ADR-030: Electronic Acceptance Boundary

The CRM records simple electronic acceptance using a session, OTP for external recipients, consent, typed name and declared authority. It is evidence for the application, not a claim of advanced electronic signature or civil identity verification.

Raw tokens and OTPs are never persisted. Actions are append-only and idempotent: their canonical request hash binds the operation, resource, normalized payload and authenticated actor. Public actions retain the public-session identifier, while internal actions retain the actor user identifier.
