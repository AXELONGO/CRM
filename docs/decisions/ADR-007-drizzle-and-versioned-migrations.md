# ADR-007: Drizzle y migraciones versionadas

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

PostgreSQL es la fuente de verdad y los cambios de esquema deben ser tipados, revisables y versionados. Todavia no existen tablas de negocio.

## Decision

Usar Drizzle ORM `0.45.2`, Drizzle Kit `0.31.10` y el driver `postgres` `3.4.9`. `postgres` tiene integracion oficial documentada por Drizzle y evita agregar los tipos separados de `pg`. Se desactivan prepared statements para compatibilidad con poolers administrados; esta opcion se revisara si el proveedor final lo requiere.

El esquema inicial queda vacio y no se genera migracion vacia. Los cambios futuros usaran `db:generate`, se revisaran en Git y se aplicaran con `db:migrate`; nunca un push directo de esquema en produccion.

## Consecuencias positivas

Tipado, SQL revisable, migraciones en el repositorio y conexion lazy que no se abre durante build.

## Costos y riesgos

Las migraciones requieren disciplina. `postgres` y poolers pueden tener diferencias de prepared statements y limites de conexiones.

## Alternativas consideradas

`pg` con Pool, Prisma y el push directo de esquema.

## Condiciones de revision

Revisar el driver al conectar el proveedor administrado de PostgreSQL, medir pool y definir el primer esquema de autenticacion o negocio.

## Referencias

- https://orm.drizzle.team/docs/get-started-postgresql
- https://orm.drizzle.team/docs/migrations
