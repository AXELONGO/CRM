# Worker de integraciones

`scripts/integration-worker.ts` utiliza la conexión `DATABASE_WORKER_URL`, reclama jobs por tenant con `SKIP LOCKED`, leases y reintentos exponenciales, y finaliza jobs permanentes como dead-letter. Un lease vencido puede ser reclamado por otro worker.

El worker establece `app.current_tenant_id` dentro de cada transacción. Los receipts se descifran con su `key_version` persistida y la normalización ocurre dentro del mismo límite transaccional del job.
