# Prompt 21C Baseline

Fecha: 2026-08-13
Estado: línea base sin modificaciones de comportamiento (Fase A).

## 1. Runtime y entorno verificado

| Comando                                                    | Resultado                  |
| ---------------------------------------------------------- | -------------------------- |
| `node --version`                                           | v24.19.0                   |
| `pnpm --version`                                           | 11.21.0                    |
| `pnpm db:check`                                            | verde                      |
| `pnpm exec tsc --noEmit`                                   | verde                      |
| PostgreSQL (docker, port 5433/test)                        | 17.10 healthy              |
| mailpit (docker)                                           | healthy                    |
| `.nvmrc` / `.node-version` / Docker / package engines / CI | Node 24.19.0, pnpm 11.21.0 |

## 2. Estado de Git

- Rama `main`, sin commits (`git log` vacío).
- Todo el árbol está sin rastrear (`git status --short` con `??` en todos los directorios).
- No se ejecutaron ni se ejecutarán operaciones Git de escritura.
- `.env` / `.env.local` no presentes; solo `.env.example` (sin secretos reales).

## 3. Migraciones, journal y drift

- Archivos en `drizzle/`: 44 ficheros SQL.
- Journal `drizzle/meta/_journal.json`: 37 entradas (idx 0-36, hasta `0037`).
- Base test: 37 filas aplicadas en `drizzle.__drizzle_migrations` (coincide con el journal).
- **Drift detectado**: 6 archivos SQL existen pero NO están en el journal ni en snapshots:
  - `0019_quote_public_resolvers.sql`
  - `0020_quote_security.sql`
  - `0027_waha_sessions.sql`
  - `0028_mercado_pago_oauth.sql`
  - `0029_stripe_connect.sql`
  - `0030_paypal_platform.sql`
- Los snapshots en `drizzle/meta/` solo cubren hasta `0028_swift_annihilus`; no hay snapshots para `0029`-`0037` (migraciones escritas a mano y añadidas al journal).
- Tablas `waha_instances`, `mercado_pago_profiles`, `stripe_profiles`, `paypal_profiles` existen en la base test (verificadas por el truncate del E2E), lo que sugiere que esos SQL sin journal fueron aplicados de forma manual/adicional.
- **Clasificación**: P1 (integridad del historial). La reconciliación se aborda en la Fase J; no se modifica ninguna migración histórica.

## 4. Scripts de validación requeridos por la Fase L

Existen: `security:supply-chain`, `security:check`, `security:actions`, `security:rls-audit`, `restore:test`, `test:run`, `test:coverage`, `test:integration`, `test:e2e`, `db:check`, `build`.

Faltan (se crearán con implementación real en Fase L): `test:rls`, `test:otp`, `test:public-security`, `test:concurrency`, `test:worker`, `test:business-rules`, `db:migrate:test`.

## 5. Hallazgos

Severidad: **P0** = cruce de tenant / bypass OTP-CSRF / reutilización de sesión / firma a destinatario ajeno / permisos runtime excesivos. **P1** = carreras, idempotencia rota, worker no ejecutable, pagos inválidos, activación inconsistente.

### 5.1 OTP — Fase B

| ID   | Severidad | Hallazgo                                                                                                                                     | Ruta/archivo                                                      | Reproducción                                                                                | Estado                                                                                                                                   |
| ---- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | P0        | Clave HMAC OTP con fallback silencioso productivo; sin validación de startup de longitud/entropía; sin contexto/purpose/versión en el digest | `src/infrastructure/security/public-otp.ts`, `instrumentation.ts` | `tests/security/repro-otp-crypto.test.ts`, `src/infrastructure/security/public-otp.test.ts` | resuelto (HMAC-SHA-256 versionado por purpose; clave mínima de 32 caracteres obligatoria fuera de test y validada al iniciar)            |
| B-02 | P0        | `E2E_OTP_PRINT=true` expone `testCode` en respuestas HTTP fuera de test                                                                      | rutas OTP, `public-otp.ts`                                        | `src/infrastructure/security/public-otp.test.ts`                                            | resuelto (`E2E_OTP_PRINT` falla fuera de `NODE_ENV=test`; sólo test puede exponer el código)                                             |
| B-03 | P0        | El contador de intentos fallidos se revierte por rollback → fuerza bruta ilimitada                                                           | funciones OTP `0044`                                              | `tests/security/repro-otp-attempts.test.ts`, `repro-agreement-otp.test.ts`                  | resuelto (locks de fila y transición atómica de intento/estado)                                                                          |
| B-04 | P0        | No hay entrega real del OTP ni outbox durable                                                                                                | `public_otp_delivery_jobs`, worker, `EmailSender`                 | `tests/security/repro-otp-attempts.test.ts`                                                 | resuelto (código AES-GCM en outbox transaccional; worker con lease/backoff lo entrega por `EmailSender`; destinatario servidor derivado) |
| B-05 | P1        | Generación de código con sesgo de módulo                                                                                                     | `src/infrastructure/security/public-otp.ts`                       | `tests/security/repro-otp-crypto.test.ts`                                                   | resuelto (`randomInt`)                                                                                                                   |
| B-06 | P1        | Sin bloqueo/cooldown/límite de reenvíos o ventana de solicitudes                                                                             | funciones OTP `0044`                                              | `tests/security/repro-otp-attempts.test.ts`, `repro-agreement-otp.test.ts`                  | resuelto (5 fallos bloquean sesión; 60 s, 3 solicitudes/15 min y 2 reenvíos)                                                             |
| B-07 | P1        | Sin auditoría de solicitud/entrega/verificación/bloqueo/reenvío                                                                              | repos OTP/outbox                                                  | pruebas OTP DB                                                                              | resuelto (eventos de solicitud/verificación y estado durable de entrega, incluido bloqueo/expiración)                                    |

### 5.2 CSRF, enlaces públicos y sesiones de un solo uso — Fase C

| ID   | Severidad | Hallazgo                                                                                                                                                           | Ruta/archivo                              | Reproducción                                                      | Estado                                                                                                       |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| C-01 | P0        | `exchangePublicQuoteLink`/`exchangeAgreementLink` NO consumen el enlace: cada POST crea una sesión nueva sin marcar `active=false` → múltiples sesiones por enlace | repos quotes, agreements                  | `repro-session-single-use.test.ts`, `repro-agreement-otp.test.ts` | resuelto (UPDATE atómico `WHERE active=true RETURNING`; el segundo uso falla sin crear sesión)               |
| C-02 | P0        | Sin consumo atómico del enlace: dos requests concurrentes crean dos sesiones (falta `UPDATE ... WHERE active=true RETURNING` / lock)                               | repos exchange                            | repro quote/agreement concurrentes                                | resuelto (las carreras dejan una sola sesión nueva por enlace)                                               |
| C-03 | P1        | Comparación CSRF no constante en tiempo y sin doble-submit cookie/body                                                                                             | rutas públicas, repos, `constant-time.ts` | `repro-csrf.test.ts`, `vertical.spec.ts`                          | resuelto (cookie/body y hash persistido se comparan en tiempo constante; token ausente o distinto falla)     |
| C-04 | P1        | CSRF no rotado al crear/elevar sesión; sin validación de Origin/Host/método/Content-Type en mutaciones públicas                                                    | rutas públicas JSON, `public-mutation.ts` | `public-mutation.test.ts`, `vertical.spec.ts`                     | resuelto (token emitido al exchange, rotado tras OTP y guard fail-closed para POST/Host/Origin/JSON exactos) |
| C-05 | P1        | Idempotencia solo por clave, sin vincular a operación/recurso/actor/hash de request; sin constraint único → carreras duplican efectos                              | repos quotes, agreements                  | `repro-csrf.test.ts`, `repro-agreement-concurrency.test.ts`       | resuelto (unique scoped a recurso+sesión; reintentos tras consumir OTP devuelven la operación original)      |

### 5.3 RLS y privilegios mínimos — Fase D

| ID   | Severidad | Hallazgo                                                                                                                                                                                                                                                 | Ruta/archivo                                                                                      | Reproducción                                                                                                                                                                           | Estado                                                                                                                                                                                                                                                                                       |
| ---- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | P0        | `crm_ingress` con `FOR ALL` sobre `quote_client_decisions`, `quote_outbox_events`, `agreement_evidence_bundles`, `agreement_outbox_events`; UPDATE sobre tablas completas `quotes` y `projects`; sesiones/desafíos con DML directo (superficie excesiva) | `drizzle/0042_d01_ingress_least_privilege.sql`, `drizzle/0043_d01_ingress_session_capability.sql` | `tests/security/repro-rls-ingress.test.ts`, `tests/security/repro-session-single-use.test.ts`, `tests/security/repro-otp-attempts.test.ts`, `tests/security/repro-csrf.test.ts` (pass) | resuelto (`0042` limita outbox/decisiones/evidencia a INSERT scoped; `0043` revoca INSERT/UPDATE/DELETE de ingress sobre sesiones/desafíos y encamina todo DML por funciones `SECURITY DEFINER` que derivan tenant desde el hash de sesión verificado, sin aceptar `tenant_id` del llamante) |
| D-02 | P0        | `crm_worker` con SELECT+INSERT+UPDATE+DELETE sobre 10 tablas sales completas (FOR ALL por tabla)                                                                                                                                                         | `drizzle/0036_worker_sales_rls_policies.sql`                                                      | repro en Fase D                                                                                                                                                                        | pendiente                                                                                                                                                                                                                                                                                    |
| D-03 | P1        | Migración `0020_quote_security.sql` con `FOR ALL TO crm_runtime, crm_worker` (herencia y permisos amplios) sin justificar                                                                                                                                | `drizzle/0020_quote_security.sql`                                                                 | repro en Fase D                                                                                                                                                                        | pendiente                                                                                                                                                                                                                                                                                    |
| D-04 | P1        | `crm_ingress` puede leer/escribir entidades de negocio tenant no resueltas (outbox y evidencia de negocio)                                                                                                                                               | migraciones 0035/0037                                                                             | repro en Fase D                                                                                                                                                                        | pendiente                                                                                                                                                                                                                                                                                    |

### 5.4 Worker, Docker, Railway y CI — Fase E

| ID   | Severidad | Hallazgo                                                                                                                                                                                       | Ruta/archivo                                       | Reproducción                         | Estado                                                                                                                               |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| E-01 | P1        | Worker NO incluido en la imagen Docker: el Dockerfile solo copia `.next/standalone` + static; `pnpm worker`/`worker:integrations` usan `tsx` (devDependency) que no existe en la imagen runner | `Dockerfile.worker`, `package.json`                | build + `test:worker`                | resuelto (imagen worker no-root con source, `tsconfig` y dependencias de ejecución; sin `.env`)                                      |
| E-02 | P1        | `railway.toml` solo define web; sin comando worker ni shutdown/claim/lease de jobs                                                                                                             | `railway*.toml`, workers                           | `test:worker`                        | resuelto (servicios Railway separados; claim durable, owner/lease, retry con jitter y shutdown ordenado)                             |
| E-03 | P1        | CI usa superusuario `postgres` como `DATABASE_URL`/`DATABASE_MIGRATION_URL`; no define `TEST_DATABASE_INGRESS_URL`/`TEST_DATABASE_WORKER_URL`; puerto 5433 vs 5432 inconsistente               | `.github/workflows/ci.yml`, `playwright.config.ts` | CI URLs explícitas                   | resuelto (migración/runtime/ingress/worker usan roles distintos y puerto CI 5432; web E2E no conserva credenciales worker/migración) |
| E-04 | P1        | Sin comprobación de que las URLs de test usen roles separados; sin RLS audit ni pruebas conductuales ingress/worker en CI                                                                      | CI, `rls-audit.ts`, repro worker                   | `test:security-repro`, `test:worker` | resuelto (CI ejecuta repros con las cuatro URLs; audit verifica rol worker y cero filas sin contexto)                                |

### 5.5 Firmas, destinatarios e idempotencia — Fase F

| ID   | Severidad | Hallazgo                                                                                                                                                                                                              | Ruta/archivo                                                | Reproducción                                         | Estado                                                                                                                                                 |
| ---- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-01 | P0        | `acceptAgreementPublicly` calcula `allAccepted` leyendo `other?.status` SIN lock sobre el resto de destinatarios; dos firmantes simultáneos pueden dejar el sobre en `partially_completed` aunque todos hayan firmado | `src/modules/agreements/infrastructure/repositories.ts`     | `tests/security/repro-agreement-concurrency.test.ts` | resuelto (sobre canónico y destinatarios bloqueados en orden; evidencia sólo tras aceptar todos los destinatarios `required`, sin reapertura terminal) |
| F-02 | P1        | Sin constraint único de firma por destinatario/acuerdo; idempotencia por clave sin vínculo a payload/actor                                                                                                            | schema agreements, `0048_agreement_signature_integrity.sql` | `repro-agreement-concurrency.test.ts`                | resuelto (acción terminal única, hash canónico y vínculo sesión pública/usuario interno; actor o payload distinto con la misma clave falla)            |
| F-03 | P1        | Verificar que ningún endpoint acepta `recipient_id`/`agreement_id` aislado del cliente (actualmente el destinatario se deriva de la sesión)                                                                           | rutas públicas, repos acuerdos                              | `repro-agreement-concurrency.test.ts`                | resuelto (body público estricto, scope derivado de sesión; aceptación interna y evidencia externa validan sobre, acuerdo y versión activos)            |

### 5.6 Interfaz pública y PDF — Fase G

| ID   | Severidad | Hallazgo                                                                                                                                       | Ruta/archivo                                                                                          | Reproducción                                                | Estado    |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------- |
| G-01 | P1        | `/api/public/quotes/current` serializa columnas BigInt (`subtotalMinor`, `totalMinor`, etc.) directamente → error o pérdida silenciosa en JSON | `public-quote-dto.ts`, ruta pública quotes | `repro-bigint-serialization.test.ts`, E2E | resuelto (DTO explícito sin filas/IDs internos; dinero y tasas como strings decimales exactos, sin mutar `BigInt.prototype`) |
| G-02 | P1        | `LocalObjectStorage.signedDownload` devuelve `file://...` y la ruta PDF lo expone en la respuesta                                              | storage local, ruta PDF pública                       | E2E PDF público                                              | resuelto (el servidor lee y devuelve bytes PDF autorizados con attachment y cabeceras privadas; no expone URL ni ruta de storage) |
| G-03 | P1        | Página pública de acuerdos incompleta (sin flujo OTP/reenvío/bloqueo/expiración/firma en navegador)                                            | `/a`, view público de acuerdos                         | `src/app/a/page.test.tsx`                                    | resuelto (revisión de secciones, OTP/reenvío, cooldown, lock, expiración, CSRF rotado, idempotencia y acciones accesibles) |

### 5.7 Proyectos, tareas y pagos — Fase H/I

| ID   | Severidad | Hallazgo                                                                                                                                                                        | Ruta/archivo                                          | Reproducción    | Estado    |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------- | --------- |
| H-01 | P1        | Activación de proyecto sin idempotencia por (proyecto, tenant, actor, comando); reintento de un proyecto activo puede recrear efectos/outbox                                    | proyectos repos                                       | repro en Fase H | pendiente |
| H-02 | P1        | Dependencias de tareas: verificar auto-dependencia, ciclos, referencias inexistentes y cruce de tenant                                                                          | tareas                                                | repro en Fase H | pendiente |
| I-01 | P1        | Pagos manuales sin caso de uso centralizado; verificar precisión monetaria (sin float), sobrepago, asignación a cuota de otro cliente/tenant/moneda, idempotencia de referencia | `src/modules/payments/infrastructure/repositories.ts` | repro en Fase I | pendiente |

### 5.8 Migraciones y documentación — Fase J/K

| ID   | Severidad | Hallazgo                                                                           | Ruta/archivo                         | Reproducción        | Estado    |
| ---- | --------- | ---------------------------------------------------------------------------------- | ------------------------------------ | ------------------- | --------- |
| J-01 | P1        | 6 archivos SQL sin journal ni snapshot; snapshots faltantes para 0029-0037         | `drizzle/`, `drizzle/meta/`          | verificar en Fase J | pendiente |
| K-01 | P1        | Inventarios/ASVS/threat model/RLS matrix/manifest no reflejan los hallazgos de 21C | `docs/security/*`, `docs/delivery/*` | Fase K              | pendiente |

## 6. Comandos ejecutados en Fase A (sin secretos)

| Comando                                             | Resultado                      | Duración    |
| --------------------------------------------------- | ------------------------------ | ----------- |
| `git status --short` / `git log`                    | todo sin trackear, sin commits | instantáneo |
| `node --version` / `pnpm --version`                 | v24.19.0 / 11.21.0             | instantáneo |
| `docker compose ps`                                 | 3 contenedores healthy         | instantáneo |
| `psql ... -d crm_test -tAc "select version()"`      | PostgreSQL 17.10               | instantáneo |
| journal vs archivos (`rg -c`)                       | 6 archivos sin journal         | instantáneo |
| `select count(*) from drizzle.__drizzle_migrations` | 37                             | instantáneo |
| `pnpm db:check`                                     | verde                          | ~1s         |
| `pnpm exec tsc --noEmit`                            | verde                          | ~10s        |

## 7. Pruebas de reproducción (Fase A)

Cada hallazgo con severidad P0/P1 tiene una prueba que falla de forma segura y demuestra el comportamiento actual. Se crean en `tests/security/`:

- `repro-otp-crypto.test.ts` — fallback de clave, flag E2E_OTP_PRINT, sesgo de módulo.
- `repro-otp-attempts.test.ts` — intentos fallidos no persisten (rollback).
- `repro-session-single-use.test.ts` — el enlace público crea múltiples sesiones.
- `repro-csrf.test.ts` — comparación CSRF no constante en tiempo.
- `repro-bigint-serialization.test.ts` — BigInt rompe la serialización HTTP.
- `repro-rls-ingress.test.ts` — superficie RLS de ingress excesiva.
- `repro-agreement-concurrency.test.ts` — carrera de firmas.

> Las pruebas DB-backed requieren PostgreSQL de test (5433) con roles `crm_test_migration`, `crm_runtime`, `crm_ingress`, `crm_worker` (verificado en 1).
