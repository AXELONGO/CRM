# ADR-040: Draft de proyecto desde OpportunityWon

## Decisión

El cierre `won` se conserva en `sales_domain_events`. El worker crea un job
`create_project_draft_from_won`; el consumidor vuelve a consultar la oportunidad
con el `TenantContext`, aplica la restricción única tenant/oportunidad y crea un
draft sin activar ni materializar tareas.

## Motivo

La entrega es idempotente y no confía en el payload histórico como fuente
autoritaria. Una oportunidad reabierta o un evento repetido no activa trabajo.
