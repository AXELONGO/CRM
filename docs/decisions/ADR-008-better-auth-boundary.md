# ADR-008: Limite de Better Auth

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

CRM necesita autenticacion, sesiones y recuperacion de cuentas, pero las empresas, membresias, roles y permisos son dominio propio del producto.

## Decision

Usar Better Auth `1.6.26` como infraestructura de identidad para credenciales, verificacion de correo, recuperacion y sesiones. No usar el plugin de organizaciones para representar el multi-tenancy del CRM. La fase de identidad integra solo las tablas tecnicas generadas por Better Auth; tenants, membresias, roles y permisos permanecen en dominio propio.

## Consecuencias positivas

Separa identidad tecnica de autorizacion de negocio y evita acoplar tenant a una libreria.

## Costos y riesgos

Habra que integrar sesiones con membresias y CSRF. Better Auth requiere secreto de alta entropia y esquema propio cuando comience la fase de identidad.

## Alternativas consideradas

Construir autenticacion propia, acoplar organizaciones de Better Auth al tenant y delegar todo a un proveedor externo.

## Condiciones de revision

Revisar al implementar membresias y permisos, o si el proveedor requiere capacidades no cubiertas por el limite de identidad.

## Referencias

- https://better-auth.com/docs/installation
- https://better-auth.com/docs/concepts/session-management
