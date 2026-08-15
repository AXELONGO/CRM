# Automatizaciones

Las automatizaciones son reglas versionadas por tenant. Una regla permanece en `draft` hasta que una operación explícita la publica como `active`; editar una versión publicada crea una nueva versión y no modifica el historial.

## Flujo

1. El cambio de negocio y `automation_events` se escriben en la misma transacción.
2. El outbox crea un `automation_jobs` con una clave idempotente.
3. `pnpm worker:automation` confirma el claim con `FOR UPDATE SKIP LOCKED` antes de ejecutar cada job. El lease configurable dura 300 segundos por defecto, se renueva al iniciar el trabajo y los reintentos aplican backoff exponencial con jitter.
4. El worker carga la versión exacta de la regla, evalúa el AST cerrado y registra `automation_rule_runs` y `automation_action_runs`.
5. Cada acción se materializa como otro job idempotente. La profundidad de causalidad máxima es cinco.

## Seguridad

- Las condiciones usan rutas de datos y operadores enumerados; no hay `eval`, SQL generado ni scripts ejecutables.
- Todas las tablas tienen `tenant_id`, RLS forzada y políticas de selección/modificación por `app.current_tenant_id`.
- Las acciones y eventos se procesan con claves de idempotencia y las reglas conservan hash, resumen y versión.
- El worker usa `DATABASE_WORKER_URL`; nunca debe compartir el usuario de ingress ni recibir `BYPASSRLS`.
- `SIGTERM` y `SIGINT` detienen nuevos claims, terminan el job en curso y devuelven los jobs aún no iniciados a `retry`.

## Tiempo

Los instantes se guardan como `timestamptz`. Los calendarios guardan la zona IANA, intervalos locales ISO-8601 y excepciones explícitas. Los SLA calculan vencimientos sobre tiempo hábil, no sumando horas de pared.
