# Pilot Gap Register

## P0

- No se libera ningún proveedor real ni datos reales mientras los escenarios PostgreSQL multi-tenant no estén automatizados.

## P1

- Backups cifrados de DB y Storage y restore drill aún requieren ejecución local aislada.
- No existe cobertura exhaustiva de RLS generada por tabla.
- MFA y revisión de seguridad externa no están implementados.
- Worker heartbeat y panel operativo aún requieren instrumentación.
- CI todavía usa actions por tag, no por SHA completo.

## P2

- WAHA media, health, cutover y outbound completo son simulación.
- Mercado Pago, Stripe y PayPal tienen adapters fake; OAuth/partner/sandbox real está bloqueado.
- E2E de todos los roles y proveedores no está completo.

## External waits

- Aprobación humana para Railway/Supabase, DNS, dominios, correo, proveedor de backups y presupuesto.
- Aprobación legal/privacidad para portal, pagos y retención.
- Credenciales y aplicaciones reales de proveedores sólo después de UAT y decisión go/no-go.
