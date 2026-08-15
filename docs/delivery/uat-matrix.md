# UAT Matrix

Estado: `technical_uat_pending`; esta matriz separa evidencia automatizada de firma humana.

|   # | Recorrido                    | Actor             | Evidencia técnica        | Estado humano |
| --: | ---------------------------- | ----------------- | ------------------------ | ------------- |
|   1 | Login verificado             | Usuario           | `tests/e2e/auth.spec.ts` | Pendiente     |
|   2 | Logout                       | Usuario           | `tests/e2e/auth.spec.ts` | Pendiente     |
|   3 | Recuperación de contraseña   | Usuario           | `tests/e2e/auth.spec.ts` | Pendiente     |
|   4 | Invitación interna           | Admin             | `tests/e2e/auth.spec.ts` | Pendiente     |
|   5 | Invitación de cliente        | Admin/Cliente     | `tests/e2e/auth.spec.ts` | Pendiente     |
|   6 | Aislamiento tenant           | Admin/Cliente     | `tests/e2e/auth.spec.ts` | Pendiente     |
|   7 | Contactos                    | Ventas            | `tests/e2e/auth.spec.ts` | Pendiente     |
|   8 | Cuentas                      | Ventas            | `tests/e2e/auth.spec.ts` | Pendiente     |
|   9 | Duplicados                   | Ventas            | `tests/e2e/auth.spec.ts` | Pendiente     |
|  10 | Pipeline                     | Ventas            | Unit/E2E                 | Pendiente     |
|  11 | Oportunidad ganada           | Ventas            | Unit/E2E                 | Pendiente     |
|  12 | Proyecto borrador            | Ejecución         | Unit/E2E                 | Pendiente     |
|  13 | Activación con prerequisitos | Ejecución         | Unit/E2E                 | Pendiente     |
|  14 | Cotización                   | Ventas            | Unit/E2E                 | Pendiente     |
|  15 | Contrato                     | Ventas/Cliente    | Unit/E2E                 | Pendiente     |
|  16 | Pago manual                  | Finanzas          | Unit/E2E                 | Pendiente     |
|  17 | Cobranza                     | Finanzas          | Unit/E2E                 | Pendiente     |
|  18 | Tareas Kanban                | Ejecución         | Unit/E2E                 | Pendiente     |
|  19 | Mensajes y comentarios       | Cliente/Ejecución | Unit/E2E                 | Pendiente     |
|  20 | Archivos privados            | Cliente/Ejecución | Unit/E2E                 | Pendiente     |
|  21 | Aprobación de entregable     | Cliente           | Unit/E2E                 | Pendiente     |
|  22 | Solicitud de soporte         | Cliente           | Unit/E2E                 | Pendiente     |
|  23 | Calendario de contenido      | Ejecución         | Unit/E2E                 | Pendiente     |
|  24 | Auditoría e idempotencia     | Operador          | Unit/E2E                 | Pendiente     |
|  25 | Jobs fallidos y reintentos   | Operador          | Unit/E2E                 | Pendiente     |
