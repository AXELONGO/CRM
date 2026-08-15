# Pilot Feature Flags

Flags remain closed by default in pilot until separately approved. Permissions still apply when a flag is enabled.

| Capability                       | Current control                             | Pilot default                   |
| -------------------------------- | ------------------------------------------- | ------------------------------- |
| Mercado Pago live                | `MERCADO_PAGO_LIVE_ENABLED`                 | off                             |
| Stripe live                      | `STRIPE_LIVE_ENABLED`                       | off                             |
| PayPal live                      | `PAYPAL_LIVE_ENABLED` and partner approval  | off                             |
| WAHA live                        | `WAHA_LIVE_ENABLED`                         | off                             |
| Outbound messaging               | provider state/capability                   | off until consent/caps verified |
| Checkout creation                | connection readiness and provider selection | fake only                       |
| Automatic capture/reconciliation | durable jobs and provider readiness         | fake only                       |
| Custom domains                   | verified domain state                       | fallback domain only            |
| Uploads                          | private storage and scanner policy          | restricted types/manual review  |

Changes require audit evidence, owner, reason and rollback. A flag is not a security boundary.
