# Threat Model

| Boundary/asset       | Threat                                       | Controls                                                                             | Residual risk/owner                              |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Browser → web        | CSRF, XSS, tenant parameter tampering        | server-derived tenant, auth, exact Origin/Host, double-submit CSRF, CSP, permissions | CSP review before pilot / security owner         |
| Portal/custom domain | host poisoning, cross-tenant resource access | verified domain model, scoped sessions, RLS                                          | full custom-domain E2E / platform owner          |
| Web → PostgreSQL     | injection, privilege escalation              | Drizzle parameters, roles NOSUPERUSER/NOBYPASSRLS, RLS                               | generated table matrix / DBA owner               |
| Web → providers      | SSRF, leaked credentials                     | fake adapters, allowlists, server-only secrets                                       | live adapters need review / integrations owner   |
| Webhook ingress      | spoofing, replay, body mutation              | raw-body HMAC, timestamp where supported, dedupe, durable event                      | provider contract tests / integrations owner     |
| Worker → jobs        | cross-tenant effects, duplicate retries      | tenant transaction context, leases, idempotency                                      | heartbeat/chaos tests / SRE owner                |
| Storage              | malicious upload, public leak                | private keys, limits, server-mediated authorized downloads without storage URLs, quarantine policy | real malware scanner deferred / operations owner |
| Backups              | plaintext leak, incomplete restore           | encrypted manifests, independent target, restore drill                               | target approval pending / recovery owner         |
| CI/repository        | secret exfiltration, unsafe action           | read-only permissions, frozen lockfile, scanning and review gates                    | pin actions to SHA / maintainer                  |
| Human operator       | mistaken deploy or rotation                  | runbooks, approval waits, release manifest, no auto deploy                           | two-person review for pilot / owner              |
