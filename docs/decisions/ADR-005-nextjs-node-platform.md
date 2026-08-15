# ADR-005: Next.js App Router como plataforma Node

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

CRM necesita una aplicacion web y endpoints en un solo despliegue, con limites claros para un monolito modular y sin depender de funciones exclusivas de un proveedor serverless.

## Decision

Usar Next.js App Router `16.3.0`, TypeScript estricto y ejecucion como servidor Node.js. Next.js sera la capa de entrega; los casos de uso y dominio viviran fuera de React y sus APIs.

## Consecuencias positivas

- Una sola aplicacion web y API.
- Routing y build integrados.
- Salida standalone para Docker.
- Compatibilidad con un servidor Node mantenido.

## Costos y riesgos

Next.js cambia rapidamente y puede facilitar que la logica se concentre en rutas si no se respetan los limites. Las actualizaciones requieren revisar compatibilidad.

## Alternativas consideradas

Express separado con frontend independiente, Pages Router y despliegue serverless especifico.

## Condiciones de revision

Revisar si los limites de despliegue o carga justifican separar entrega web, API o workers.

## Referencias

- https://nextjs.org/docs/app/getting-started/installation
