# Prompt 21 Baseline

Fecha: 2026-08-12

## Línea base

- Proyecto: Next.js App Router, TypeScript estricto, Drizzle, PostgreSQL, Better Auth.
- Runtime declarado: Node `24.19.0`, pnpm `11.21.0`.
- Runtime observado durante esta ejecución: Node `26.0.0`, pnpm `11.21.0`; queda `WAIT-NODE-24.19.0`.
- Migraciones registradas después de este cambio: `0029_rls_prompt21`.
- Roles funcionales: `tenant_admin`, `sales`, `execution`, `finance`, `client`.
- Rol de plataforma: administrador registrado en `platform_administrators`.
- Métodos habilitados: credenciales con verificación de correo; no se habilitaron social, magic link, SMS ni email OTP.
- Acciones CI externas: checkout, pnpm/action-setup y setup-node, fijadas a SHA completo.
- Proveedores reales: deshabilitados.

## Estado Git

El árbol ya contenía cambios locales no rastreados al iniciar. No se ejecutaron operaciones Git de escritura.
