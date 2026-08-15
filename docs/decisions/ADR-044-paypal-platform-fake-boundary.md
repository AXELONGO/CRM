# ADR-044: PayPal Commerce Platform y límite fake

## Estado

Aceptada para desarrollo local.

## Decisión

PayPal se modela como proveedor seleccionable con Partner Referral, una cuenta merchant por tenant, Orders v2 y captura server-side. El merchant recibe la liquidación directamente; CRM no custodia, divide ni cobra comisiones de plataforma.

La implementación actual usa exclusivamente `FakePayPalServer`. `PAYPAL_LIVE_ENABLED=false` y la aprobación de partner se representa como configuración de readiness, no como aprobación real.

## Consecuencias

- Los retornos del comprador y onboarding no confirman pagos ni conexión por sí mismos.
- Webhooks firmados y consulta autoritativa son necesarios para conciliar.
- El fee fake se conserva como dato de conciliación; nunca reduce el adeudo interno.
- Habilitar sandbox/live requiere aprobación de PayPal, credenciales por entorno, BN code, webhook registrado y revisión legal/financiera.
