# ADR-004: Puertos y adaptadores

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

CRM necesita conectores intercambiables de mensajeria, pagos, correo, archivos y futuros canales.

## Decision

Definir puertos internos con modelos comunes y colocar cada proveedor en un adaptador. Los webhooks se traduciran al modelo interno despues de verificar firma e idempotencia.

## Consecuencias positivas

Sustitucion de proveedores, pruebas con adaptadores falsos y menor acoplamiento.

## Costos/riesgos

Requiere contratos pequenos. Un modelo comun pobre puede perder capacidades del proveedor.

## Alternativas descartadas

Usar payloads o clases de proveedor directamente en casos de uso.

## Condiciones de revision

Revisar cada puerto al implementar el primer adaptador real.
