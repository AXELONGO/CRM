# Secrets Inventory

No values are stored here.

| Secret/ref                          | Owner/process             | Environments        | Scope/rotation                                |
| ----------------------------------- | ------------------------- | ------------------- | --------------------------------------------- |
| `BETTER_AUTH_SECRET`                | auth/web                  | each environment    | rotate with session invalidation              |
| `INTEGRATION_ENCRYPTION_KEY`        | web/worker/ingress        | each environment    | versioned overlap, then revoke old key        |
| `DATABASE_*` URLs/passwords         | operator/process-specific | each environment    | rotate after restore or incident              |
| `PUBLIC_FORM_SIGNING_KEY`           | forms                     | each environment    | versioned rotation                            |
| Agreement challenge/evidence keys   | agreements                | each environment    | versioned rotation                            |
| Meta/WAHA verifier refs             | integration worker        | tenant/environment  | rotate per connection                         |
| Mercado Pago tokens                 | payment vault             | tenant/environment  | fake now; revoke/reconnect live               |
| Stripe platform config              | platform operator         | environment         | no tenant token persistence in current design |
| PayPal platform credentials/BN code | platform operator         | environment         | blocked until partner approval                |
| SMTP credentials                    | email operator            | environment         | rotate via provider                           |
| Backup encryption recipient/key     | recovery owner            | offline/environment | dual-control rotation                         |
| GitHub/Railway/Supabase credentials | platform operator         | environment         | environment secrets, never PRs                |

Rotation procedure: generate replacement, load server-side, verify with fake/local health, switch references atomically where supported, revoke the old value, invalidate caches/sessions, audit and document rollback. Real rotation is a human wait.
