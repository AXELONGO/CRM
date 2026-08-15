# MVP Traceability Matrix

Estado máximo permitido por esta fase: `release_candidate` local. `complete` significa que existe código, pruebas y documentación suficiente; los conectores externos siguen fake.

| ID     | Área                        | Dueño                 | Evidencia                               | Estado           | Severidad | Decisión                                                    |
| ------ | --------------------------- | --------------------- | --------------------------------------- | ---------------- | --------- | ----------------------------------------------------------- |
| MVP-01 | Auth, roles y membresías    | tenancy/auth          | `src/infrastructure/auth`, policy tests | complete         | P1        | Validar MFA antes de piloto real                            |
| MVP-02 | Aislamiento tenant/RLS      | database/tenancy      | migraciones RLS, `withTenantDatabase`   | partial          | P0        | Ejecutar matriz PostgreSQL por tabla antes de datos reales  |
| MVP-03 | Directorio comercial        | commercial-directory  | APIs, schema y tests                    | complete         | P1        | UAT por roles pendiente                                     |
| MVP-04 | Ventas y oportunidades      | sales                 | rutas sales, schemas, tests             | complete         | P1        | UAT pendiente                                               |
| MVP-05 | Inbox multicanal            | inbox                 | canonical model, ingress, worker        | partial          | P1        | WAHA/media/health real deferred                             |
| MVP-06 | Cotizaciones y contratos    | quotes/agreements     | rutas públicas, RLS y tests             | complete         | P1        | Revisión legal humana pendiente                             |
| MVP-07 | Proyectos y portal          | projects/portal       | activación, portal y tests              | partial          | P1        | E2E de permisos y archivos pendiente                        |
| MVP-08 | Cobranza interna            | payments              | receivables, bigint, allocations        | complete         | P0        | No sustituir por proveedor externo                          |
| MVP-09 | Mercado Pago fake           | payments/integrations | adapter, OAuth fake, webhook            | partial          | P1        | Live bloqueado; renovar tokens/health pendiente             |
| MVP-10 | Stripe fake                 | payments/integrations | FakeStripeServer, Connect fake          | partial          | P1        | Live bloqueado; SDK real no instalado                       |
| MVP-11 | PayPal fake                 | payments/integrations | FakePayPalServer, Orders/Capture        | partial          | P1        | Partner approval y sandbox externo son waits                |
| MVP-12 | CI/CD y release             | operations            | workflow, Docker, Railway config        | partial          | P1        | Actions no están pinneadas a SHA                            |
| MVP-13 | Backups y restore           | operations            | política y scripts planificados         | blocked_external | P1        | Ejecutar restore con DB/Storage sintéticos antes del piloto |
| MVP-14 | Seguridad ASVS/threat model | security              | gap analysis y threat model             | partial          | P1        | Revisión humana/penetration test pendiente                  |
| MVP-15 | Piloto y costos             | operations            | gap register, cost model, go/no-go      | blocked_external | P1        | DNS, cuentas, legal y presupuesto requieren aprobación      |
