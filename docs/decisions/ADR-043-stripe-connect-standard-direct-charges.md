# ADR-043: Stripe Connect Standard y direct charges

## Estado

Aceptada para simulación local.

## Decisión

CRM conecta cuentas Stripe Standard mediante OAuth Connect y crea Checkout Sessions alojadas como direct charges, con `Stripe-Account` resuelto server-side. La cuenta conectada es merchant of record.

CRM no recibe, divide ni transfiere fondos y no usa `application_fee_amount`, `transfer_data`, `destination`, `on_behalf_of` ni `transfer_group`.

Durante desarrollo se usa `FakeStripeServer`; `STRIPE_LIVE_ENABLED=false` y no se realizan llamadas externas.

## Consecuencias

- Stripe conserva el Dashboard, payouts, KYC y configuración de la agencia.
- El dominio financiero interno sigue siendo la fuente de verdad.
- Webhooks se validan antes de consultar y aplicar pagos.
- Tokens OAuth obsoletos no se persisten; sólo se conserva metadata allowlisted de la cuenta.
- Habilitar live requiere revisión oficial, configuración de plataforma y pruebas de sandbox.
