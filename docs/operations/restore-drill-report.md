# Restore Drill Report

Estado: `passed`

`restore-drill.ts` usa PostgreSQL real, `pg_dump`, `pg_restore`, una base temporal explícita `crm_restore_drill_<id>` y storage local con bytes sintéticos reales. Verifica checksum del dump, checksum del objeto restaurado, cabeza de migraciones, identidad de base y fallos inyectados de checksum/objeto ausente. La ejecución debe ocurrir con Docker y PostgreSQL de prueba activos.

El respaldo offsite y el restore con credenciales reales siguen siendo `WAIT-OFFSITE-BACKUP`. El drill local sólo elimina la base con el identificador exacto creado por esa ejecución.

Última ejecución: `453021772f254ede`.

- PostgreSQL 17 source dump through container utility.
- Isolated PostgreSQL 17 destination container.
- Dump checksum: `7d975aedba16d44a2d4d8c29a068e467fa586f1ded85dd39e6a12e66587c6a9a`.
- Synthetic object checksum: `d85df8e42809fbcbe3f6178dca584a339836969eccccb93c906916341905bd5f`.
- Failure injections: checksum mismatch and missing object detected.
- Cleanup: destination container removed by exact generated identifier.
