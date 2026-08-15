# ADR-011: Autenticacion y politica de sesiones

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

CRM necesita una identidad tecnica segura antes de construir tenants, membresias, invitaciones, roles o permisos. El MVP no tiene registro publico y debe permitir alta controlada para desarrollo y pruebas.

## Decision

Usar Better Auth `1.6.26` con el adaptador oficial `@better-auth/drizzle-adapter` `1.6.26` sobre PostgreSQL y Drizzle. El esquema es generado por la CLI oficial de Better Auth y se aplica mediante una migracion versionada de Drizzle. Las tablas `user`, `account`, `session` y `verification` son tecnicas de identidad; no representan tenants ni membresias.

El unico metodo de esta fase es correo y contrasena. El registro publico permanece deshabilitado. El script `pnpm auth:bootstrap-local` es el unico alta local y exige un entorno no productivo y `AUTH_BOOTSTRAP_ENABLED=true`. Produccion rechaza esa bandera.

Better Auth exige verificacion de correo, usa contrasenas de 12 a 128 caracteres, tokens de recuperacion de 60 minutos y revoca sesiones al restablecer la contrasena. La sesion dura 7 dias y se actualiza diariamente. La cache de sesion en cookie permanece desactivada para que la revocacion se consulte en PostgreSQL inmediatamente.

Las cookies de sesion son gestionadas por Better Auth, `httpOnly`, `sameSite` seguro, limitadas al host actual y `secure` en produccion. CSRF y comprobacion de origen permanecen activos. `trustedOrigins` se construye con URLs exactas validadas; no se usan comodines. Los dominios propios de agencias quedan diferidos y una cookie no se compartira entre dominios de agencias.

El envio se consume mediante el puerto `EmailSender` y el adaptador SMTP de Nodemailer. Mailpit es el SMTP local de desarrollo y pruebas; el proveedor transaccional de produccion sigue abierto. Los callbacks de Better Auth inician el envio sin esperar su resultado para conservar la proteccion de enumeracion recomendada. Los fallos se registran sin destinatarios completos, tokens ni contrasenas.

El rate limiting oficial de Better Auth usa memoria con reglas mas estrictas para login, recuperacion y reenvio. Es adecuado para una sola instancia piloto, no para limites globales en multiples instancias.

## Separacion multiempresa

La sesion solo prueba identidad y correo verificado. No asigna tenant, agencia, membresia, rol ni permiso. Las futuras verificaciones de autorizacion derivaran pertenencia y alcance en backend, nunca de un `userId` enviado por el cliente.

## Consecuencias positivas

- Se evita implementar criptografia, hashes, tokens y revocacion propios.
- La identidad tecnica queda separada del modelo multiempresa futuro.
- SMTP y Mailpit se pueden sustituir sin modificar los casos de uso.
- La ruta `/app` tiene una comprobacion real de servidor, no solo una redireccion de interfaz.

## Costos y riesgos

- Better Auth y su esquema deben actualizarse coordinadamente.
- El rate limiting en memoria no ofrece limites globales con varias instancias.
- Mailpit no es un proveedor de produccion y no debe recibir datos reales.
- La verificacion de correo y recuperacion dependen de readiness de PostgreSQL y SMTP.

## Alternativas consideradas

Autenticacion propia, OAuth, magic links, plugin `organization` de Better Auth, Redis para rate limiting y proveedor de correo transaccional desde esta fase.

## Condiciones de revision

Revisar al implementar membresias y permisos, al tener mas de una instancia, al elegir proveedor transaccional, al definir dominios propios o si se requieren 2FA, passkeys u OAuth.

## Referencias oficiales consultadas

- https://better-auth.com/docs/integrations/next
- https://better-auth.com/docs/adapters/drizzle
- https://better-auth.com/docs/authentication/email-password
- https://better-auth.com/docs/reference/options
- https://better-auth.com/docs/concepts/cli
- https://orm.drizzle.team/docs/get-started-postgresql
- https://orm.drizzle.team/docs/migrations
- https://nextjs.org/docs/app
