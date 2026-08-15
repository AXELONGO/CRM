# ADR-017: Sales Audit and Domain Events

## Estado

Aceptado

## Decisión

Los cambios de etapa y estado se registran como historial append-only. Cada cierre ganado crea un evento durable `OpportunityWon` dentro de la misma transacción que actualiza la oportunidad. El evento no ejecuta integraciones externas; su consumo queda fuera del alcance del MVP.

El forecast se calcula en unidades monetarias menores y se agrupa por moneda. No se convierten monedas ni se mezclan totales de divisas distintas.

## Consecuencias

- Las operaciones son auditables y resistentes a reintentos.
- Los consumidores futuros pueden procesar el evento sin alterar la transacción comercial.
- Los datos financieros no sufren conversiones implícitas.
