# ADR-006: pnpm y runtime Node LTS

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

El equipo necesita instalaciones reproducibles y una version de Node compatible con Next.js estable y soporte LTS.

## Decision

Usar pnpm `11.21.0` y Node `24.19.0`, fijados en `package.json#packageManager`, `engines` y `.nvmrc`. El lockfile se conserva en el repositorio.

## Consecuencias positivas

Instalaciones deterministas, CI reproducible y runtime LTS mantenido.

## Costos y riesgos

El propietario debe instalar o activar pnpm mediante Corepack. Una version exacta requiere actualizar el repositorio cuando termine su soporte.

## Alternativas consideradas

npm, yarn y rangos abiertos de Node.

## Condiciones de revision

Revisar el runtime cuando Node 24 deje de estar en soporte o Next.js requiera otra version.

## Referencias

- https://nodejs.org/en/about/previous-releases
- https://pnpm.io/installation
