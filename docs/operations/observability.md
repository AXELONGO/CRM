# Observability and SLOs

## First-party signals

- Web: `/api/health/live`, `/api/health/ready`, request latency/error class and release identity.
- Worker: job backlog, oldest age, retries, dead letters, lease expiry and shutdown marker.
- Webhooks: invalid signatures, duplicates, receipt age, processing lag and unknown events.
- Payments: provider state, reconciliation mismatches, pending captures and reversals.
- Continuity: backup age, checksum failures and restore-drill age.

Metrics are aggregate and must not include messages, emails, phones, tokens, raw payloads or high-cardinality tenant identifiers. Until an approved monitoring provider exists, the operator reviews this checklist manually.

## Pilot objectives, not SLA

- Monthly availability target: 99.0%.
- Main-view server p95: below 800 ms excluding provider calls.
- Webhook receipt p95 after verification: below 1 s.
- Normal job lag p95: below 60 s.
- Backup age: below 26 h.
- Restore drill: less than 35 days old.
- P1 detection during support hours: below 30 min.

## Alerts and owners

| Signal                | Threshold                     | Owner/runbook              |
| --------------------- | ----------------------------- | -------------------------- |
| Readiness failing     | 3 consecutive checks          | web-down                   |
| Worker stale          | heartbeat beyond lease window | worker-down                |
| Dead-letter growth    | any payment/security job      | queue-lag/payment-mismatch |
| Invalid webhook spike | 5 in 10 min                   | webhook-backlog            |
| Backup overdue        | >26 h                         | backup-failed              |
| Restore drill overdue | >35 days                      | restore                    |
| Cost forecast         | >MXN 400 warning, >500 no-go  | cost-threshold             |
