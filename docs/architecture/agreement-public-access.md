# Agreement Public Access

The public flow exchanges a one-time opaque link token for an HttpOnly session and a separate CSRF token. The raw link is not stored. External actions require a short-lived OTP challenge, session validity, CSRF and recipient availability. Responses are no-store and generic on failure.

The link is consumed by an atomic `UPDATE ... WHERE active = true RETURNING` before a session is created. Every public JSON mutation requires an exact `POST`, `Host` and `Origin` matching `APP_BASE_URL`, plus `Content-Type: application/json`. An action sends the non-HttpOnly CSRF cookie value in its body; the route and repository compare it in constant time. The token is issued on link exchange and rotated after successful OTP verification.

The action body is strict and never accepts agreement, envelope or recipient identifiers. The repository derives that scope from the session, locks the canonical envelope and its recipients in a deterministic order, and completes evidence only after every required recipient has accepted. Terminal envelopes cannot be reopened.

An action stores a canonical request hash together with its public session or internal user. Retrying an idempotency key succeeds only when the actor and normalized payload match the original request; a changed payload or actor is rejected. Composite database constraints bind actions, evidence and external PDF records to the matching agreement, version, envelope and recipient.

The `/a` page renders escaped immutable sections from the session-scoped version, requests and verifies the OTP, reads the rotated CSRF cookie only when submitting an action, and keeps one idempotency key for an unchanged retry. It presents cooldown, lock, expiry, terminal, external-PDF, pending-signature and completion states without exposing tokens, OTPs, tenant identifiers or resource identifiers.

The current implementation is intentionally limited to the agreement recipient scope; it does not create a permanent portal session.
