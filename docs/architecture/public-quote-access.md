# Public Quote Access

Quote links are exchanged by `POST /api/public/quotes/exchange`. The one-time token is accepted in the request body, hashed in PostgreSQL, and exchanged for an expiring HttpOnly session plus a separate CSRF token. Quote data is read through `/api/public/quotes/current` with `Cache-Control: no-store`.

The legacy token-in-path handler was removed. Public lookup uses the ingress role only for minimal token resolution and sets the tenant context before reading quote data. Raw tokens are not logged or stored.

Writes to `quote_public_sessions` and `quote_email_challenges` by the ingress role are executed exclusively through `SECURITY DEFINER` functions (`exchange_quote_link_and_create_session`, `create_quote_email_challenge`, `record_quote_otp_attempt`, `rotate_quote_session_csrf`, `consume_quote_email_challenge`, `apply_quote_decision_status`, `reconcile_project_commercial_scope`). The functions derive tenant and quote from a verified, unrevoked, unexpired session hash and never accept a caller-supplied `tenant_id`; `crm_ingress` retains SELECT-only access to those two tables.

OTP delivery requires the quote's active primary contact email and queues an AES-GCM encrypted code in `public_otp_delivery_jobs`. The worker sends it through `EmailSender`; the code is never persisted or returned in clear outside test runtime. Requests are session-bound and capped at five failed attempts, a 60-second cooldown, three requests per 15 minutes, and two resends.

Every public JSON mutation requires an exact `POST`, `Host` and `Origin` matching `APP_BASE_URL`, plus `Content-Type: application/json`. A decision must supply the non-HttpOnly CSRF cookie value in its body; the route compares those values in constant time and the repository independently compares the persisted hash in constant time. A CSRF token is issued on link exchange and rotated after each successful OTP verification.

`GET /api/public/quotes/current` returns an explicit public DTO rather than database rows. It exposes only reviewable quote and line-item fields; every minor-unit amount and rate is an exact decimal string, so no response depends on a global `BigInt` serializer or a lossy JavaScript number conversion.

`GET /api/public/quotes/pdf` derives the storage key from the valid public session and streams the PDF bytes from the server. It never returns a storage URL or filesystem path. The response is an attachment with `application/pdf`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `nosniff`, and a fixed safe filename.
