# OWASP ASVS 5.0 Gap Analysis

This is an engineering self-assessment, not certification.

| Area                  | Evidence                                               | Status  | Gate                                   |
| --------------------- | ------------------------------------------------------ | ------- | -------------------------------------- |
| V1 architecture       | modular boundaries, ADRs, threat model                 | partial | review external boundaries             |
| V2 authentication     | Better Auth, server sessions, reset/email flows        | partial | MFA and full rate-limit review         |
| V3 session management | httpOnly session boundary and membership re-resolution | partial | custom-domain/session E2E              |
| V4 access control     | server permissions, tenant context, RLS                | partial | generated PostgreSQL isolation suite   |
| V5 validation         | Zod schemas and parameterized Drizzle queries          | partial | fuzz public inputs                     |
| V6 cryptography       | AES-GCM integration vault, HMAC webhooks               | partial | key rotation/restore drill             |
| V7 errors/logging     | sanitized responses and limited logs                   | partial | structured correlation logging         |
| V8 data protection    | private storage and bigint money                       | partial | retention/export review                |
| V9 communications     | HTTPS required for future live providers               | partial | TLS/domain setup human wait            |
| V10 malicious code    | frozen lockfile, lint, CI                              | partial | dependency/image advisory scan         |
| V11 business logic    | state machines, idempotency, server money              | partial | payment concurrency/E2E matrix         |
| V12 files             | size/type/path controls                                | partial | malware scanner or manual pilot policy |
| V13 API               | body limits, auth and webhook signatures               | partial | rate-limit inventory and test          |
| V14 configuration     | env schema, no `.env` in image                         | partial | production secret manager setup        |
