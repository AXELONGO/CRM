# Pilot Go/No-Go

## Current decision: NO-GO for real data

### Green locally

- Node/pnpm versions are pinned in project metadata.
- Format, lint, typecheck, unit tests, build, migration check and Docker Compose config pass.
- 79 unit tests pass with all external providers fake/disabled.
- Runtime and worker database roles are non-superuser and `NOBYPASSRLS`.
- Liveness/readiness endpoints and Docker healthcheck exist.
- CI has read-only permissions, frozen lockfile and migration/build container gates.

### Blocking evidence

- No isolated PostgreSQL RLS matrix across every tenant-owned table.
- No completed encrypted DB + private Storage backup and restore drill.
- No production secret manager, domains, TLS, email provider or monitoring account.
- Meta, WAHA, Mercado Pago, Stripe and PayPal real credentials and external approvals are intentionally absent.
- Full role UAT, accessibility, load and incident exercises are not complete.
- GitHub Actions are now pinned to reviewed full SHAs and audited by `pnpm security:actions`.

## Prompt 21 evidence

- Full SHA action audit passes with `pnpm security:actions`.
- PostgreSQL RLS audit passes with 148 tenant relations, 587 policies, forced RLS and safe runtime roles.
- Official Better Auth TOTP plugin and migration `0028_swift_annihilus.sql` are installed; enforcement defaults to enabled through `MFA_ENFORCEMENT_ENABLED`.
- Load smoke is explicitly local-only; full workload scenarios remain pending.
- Technical UAT matrix and human checklist exist; no human signatures have been recorded.
- Prompt 21 report keeps `release_candidate_verified=false` until MFA E2E, real restore, complete load, SBOM, Docker build and technical UAT evidence are green.

### Human waits

- Approve infrastructure provider, region, budget and custom-domain strategy.
- Approve backup destination and offline encryption key custody.
- Review legal/privacy/retention and provider terms.
- Complete synthetic restore drill and security review.
- Approve first pilot tenants and release SHA.

The highest safe state after local evidence is `release_candidate`, not `pilot_go` or `production-ready`.
