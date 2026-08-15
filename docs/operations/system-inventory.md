# System Inventory

## Processes

- Web: Next.js standalone, `pnpm start`, non-root container and `/api/health/ready` health check.
- Integration worker: `pnpm worker:integrations` locally; `Dockerfile.worker` in Railway with `railway.integration-worker.toml` and `DATABASE_WORKER_URL` as its only database credential.
- Automation worker: `pnpm worker:automation` locally; `Dockerfile.worker` in Railway with `railway.automation-worker.toml` and `DATABASE_WORKER_URL` as its only database credential.
- Migration operator: `pnpm db:migrate`; no migration on web startup.

## External boundaries

- PostgreSQL runtime, ingress and worker roles.
- Private filesystem/S3-compatible storage abstraction.
- Mailpit/local SMTP in development.
- Meta, WAHA, Mercado Pago, Stripe and PayPal adapters are fake/disabled by default.

## Health and public routes

- `/api/health/live`: process-only liveness.
- `/api/health/ready`: config plus `select 1` readiness.
- Public quote, agreement, payment and webhook routes are token/signature scoped.

## Sensitive data

- Auth/session material, integration secrets, webhook verifier material, payment provider credentials and private files.
- Never include raw webhook bodies, tokens, DSNs or PII in logs/artifacts.

## Database

- Drizzle migrations `0000` through `0047`.
- Tenant tables use composite tenant foreign keys and RLS where applicable.
- Runtime/worker/ingress roles are `NOSUPERUSER NOBYPASSRLS`.
