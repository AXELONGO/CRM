# Disaster Recovery Runbook

## Initial response

1. Declare incident owner and correlation ID.
2. Stop risky writes or disable the affected provider/feature flag.
3. Preserve logs, migration version, backup manifests and job state without copying secrets or PII.
4. Communicate impact and next update time to the pilot owner.

## Database loss/corruption

1. Isolate the damaged database.
2. Select the latest verified encrypted backup within the RPO target of 24 hours.
3. Restore into an isolated database, then validate migrations, RLS, counts and smoke tests.
4. Rotate database credentials after restore and reconfigure services.
5. Reconcile outbox, payment webhooks and jobs before reopening writes.

## Storage loss

Restore private objects from the independent manifest, verify checksums and permissions, then reconcile file metadata. Do not make a bucket public to accelerate recovery.

## Secret compromise

Disable the affected integration, rotate the secret in the source system, invalidate sessions/caches, inspect audit logs and reauthorize only after verification.

## Deploy or migration failure

Rollback the image only when schema compatibility is documented. Otherwise use a forward fix. Never promise destructive down migrations.

## External provider outage

Pause new outbound actions, preserve inbound signed events, show degraded status and reconcile when provider health returns. CRM remains authoritative for receivables.

## Reopening

Owner records evidence, validates health/readiness, runs smoke/UAT for affected roles and documents a postmortem.
