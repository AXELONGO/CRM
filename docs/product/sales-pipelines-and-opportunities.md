# Pipelines y oportunidades

El módulo de ventas permite gestionar pipelines editables por tenant, mover oportunidades entre etapas, registrar actividades y consultar un forecast ponderado.

## Reglas principales

- Una oportunidad siempre pertenece a un tenant, pipeline y etapa del mismo pipeline.
- Se requiere una cuenta o un contacto como parte comercial.
- El responsable debe ser un miembro activo con rol `sales` o `tenant_admin`.
- Una oportunidad abierta puede cerrarse como ganada o perdida; una perdida requiere motivo.
- Ganadas y perdidas no se mueven hasta reabrirse explícitamente.
- El forecast separa monedas y calcula el valor ponderado con la probabilidad efectiva.

## Aprovisionamiento

El comando no se ejecuta automáticamente. Requiere alcance explícito:

```bash
pnpm sales:provision-default-pipelines --tenant-id=<tenant-id>
pnpm sales:provision-default-pipelines --all
```
