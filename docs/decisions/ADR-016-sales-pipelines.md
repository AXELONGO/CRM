# ADR-016: Tenant-Owned Sales Pipelines

## Estado

Aceptado

## Decisión

Los pipelines, etapas, fuentes, motivos de pérdida, oportunidades y actividades pertenecen al tenant. El tenant recibe una plantilla inicial mediante un comando explícito e idempotente; después puede editar su configuración sin modificar una plantilla global.

Las etapas usan posiciones sparse y las operaciones de movimiento requieren `version` para evitar sobrescribir cambios concurrentes. Las referencias pipeline-etapa incluyen `tenant_id` para impedir combinaciones entre pipelines.

## Consecuencias

- RLS y las APIs derivan el tenant del contexto autenticado.
- El aprovisionamiento se puede repetir sin duplicar la plantilla.
- Un tenant puede evolucionar su proceso comercial independientemente.
