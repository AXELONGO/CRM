# Local Load Test Report

Estado: `smoke_passed`, suite de negocio completa pendiente.

`pnpm load:test:smoke` exige `RUN_LOCAL_LOAD=true`, sólo acepta `localhost`/`127.0.0.1`, ejecuta por defecto 100 requests con concurrencia 25 contra `/api/health/live` y registra p50/p95/p99 y errores. `LOAD_REQUESTS` y `LOAD_CONCURRENCY` permiten ampliar el smoke local dentro de límites seguros. No representa aún los escenarios de 100 webhooks, 1,000 jobs, 10,000 mensajes o 2,000 contenidos; esos escenarios requieren dataset sintético y medición del worker.

Última ejecución: 100 requests, concurrencia 25, 0 errores, p50 55.35 ms, p95 657.16 ms, p99 661.66 ms.
