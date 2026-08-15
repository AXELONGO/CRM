# ADR-002: PostgreSQL como fuente de verdad

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

CRM necesita consistencia para tenants, permisos, ventas, proyectos, pagos, auditoria y webhooks. Las hojas de calculo no ofrecen esos controles.

## Decision

PostgreSQL sera la unica fuente de verdad transaccional. Los archivos se almacenaran externamente con metadatos y permisos en PostgreSQL.

## Consecuencias positivas

Integridad referencial, transacciones consistentes, base para RLS y menor duplicacion de estado.

## Costos/riesgos

Se requieren migraciones y backups correctos. Consultas sin filtros pueden ser costosas.

## Alternativas descartadas

Google Sheets como base de datos, bases duplicadas y binarios en PostgreSQL.

## Condiciones de revision

Revisar solo si volumen o residencia de datos requiere particionamiento o bases separadas.
