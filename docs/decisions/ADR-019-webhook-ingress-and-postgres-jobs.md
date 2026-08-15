# ADR-019: Ingress de webhooks y jobs PostgreSQL

## Estado

Aceptada

El ingress lee el body como bytes, limita su tamaño, resuelve la ruta pública, valida firma antes de parsear y guarda receipt cifrado más job en una transacción. El worker usa una conexión separada sin `BYPASSRLS`, establece el tenant, reclama jobs con `FOR UPDATE SKIP LOCKED` y leases recuperables, y aplica backoff/dead-letter.

```mermaid
sequenceDiagram
  participant P as Proveedor
  participant I as Ingress
  participant D as PostgreSQL
  participant W as Worker
  P->>I: Bytes + firma
  I->>D: Receipt + job atomicos
  W->>D: Claim con lease
  W->>D: Normaliza y persiste inbox
```
