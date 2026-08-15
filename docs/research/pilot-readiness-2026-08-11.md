# Pilot Readiness Research

Consulted: 2026-08-11. This document records planning references; no accounts, credentials or external configuration were used.

- Next.js deployment/self-hosting: https://nextjs.org/docs/app/getting-started/deploying
- Railway deployments/healthchecks/config: https://docs.railway.com/deployments/healthchecks
- Supabase pricing/backups: https://supabase.com/pricing and https://supabase.com/docs/guides/platform/backups
- PostgreSQL backup tools: https://www.postgresql.org/docs/current/backup.html
- GitHub Actions security/secrets: https://docs.github.com/en/actions/reference/security/secure-use
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- Drizzle migrations: https://orm.drizzle.team/docs/migrations

Operational decisions: local release candidate only; Railway config is non-secret and inactive; Supabase Free cannot be the only backup; external backup target, DNS, domains, provider credentials, legal review and budget require human approval. Prices and provider limits must be revalidated before purchase.
