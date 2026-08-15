# ADR-009: PostgreSQL y almacenamiento mediante adaptadores

## Estado

Aceptada

## Fecha

2026-08-11

## Contexto

CRM necesita una fuente de verdad transaccional y almacenamiento privado de archivos sin guardar bytes en PostgreSQL. El proveedor concreto no debe acoplar el dominio ni bloquear una futura migracion.

## Decision

Usar PostgreSQL como unica fuente de verdad mediante Drizzle. Usar un puerto de almacenamiento con un adaptador de filesystem para desarrollo y un adaptador S3-compatible o equivalente para produccion. Los metadatos, relaciones, permisos y tenant se conservaran en PostgreSQL; los bytes quedaran fuera.

El proveedor administrado de PostgreSQL y el proveedor de archivos se seleccionaran antes del piloto y quedaran documentados en un ADR posterior si la decision afecta costos u operacion. El desarrollo local usara PostgreSQL en Docker Compose.

## Consecuencias positivas

Evita acoplamiento a un proveedor concreto, permite desarrollo local sencillo y conserva control de permisos y metadatos en PostgreSQL.

## Costos y riesgos

El adaptador de produccion debe implementar autenticacion, URLs firmadas, limites, retencion y eliminacion. El filesystem local no es adecuado para una aplicacion desplegada con multiples instancias.

## Alternativas consideradas

Acoplar PostgreSQL y archivos a un unico proveedor, binarios dentro de PostgreSQL y almacenamiento local como solucion de produccion.

## Condiciones de revision

Revisar al seleccionar proveedor de produccion, superar el volumen piloto o requerir residencia, antivirus o retencion avanzada.

## Referencias

- https://www.postgresql.org/docs/current/
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
