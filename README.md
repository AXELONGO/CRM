# CRM

CRM es una plataforma multiempresa para agencias y empresas de servicios profesionales. Une prospectos, ventas, proyectos, tareas, cotizaciones, conversaciones, cobranza, contenido y portal del cliente en una sola experiencia.

## Estado

CRM tiene identidad tecnica, tenants, membresias, roles, permisos y un directorio comercial aislado por RLS. El directorio cubre contactos, cuentas comerciales, metodos, relaciones, etiquetas, notas, consentimientos, busqueda, archivo y auditoria. Oportunidades y pipelines quedan para la siguiente fase.

## MVP

El MVP tendra incorporacion controlada para CRM y dos o tres empresas piloto. No habra registro publico ni cobro automatico. Cada empresa sera un tenant independiente y sus datos nunca se mezclaran.

Los procesos conectados son prospecto a cierre, venta a entrega, cotizacion a factura y conversacion a reactivacion. Tambien incluye planificacion editorial: idea o nota a brief, produccion, revision, aprobacion y publicacion registrada.

## Principios

- Monolito modular con limites explicitos.
- Next.js App Router, Node.js, TypeScript estricto, pnpm y PostgreSQL quedan fijados.
- Drizzle ORM gestiona el acceso tipado y Better Auth queda reservado para la siguiente fase de identidad.
- PostgreSQL sera la fuente de verdad transaccional.
- Multi-tenancy, permisos y auditoria se aplican desde el primer esquema.
- Integraciones mediante puertos y adaptadores.
- No se agregan microservicios, Kubernetes, Redis ni colas complejas sin necesidad demostrada.

## Navegacion

- [Documentacion](docs/README.md)
- [Vision](docs/product/vision.md)
- [Alcance del MVP](docs/product/mvp-scope.md)
- [Flujos principales](docs/product/core-workflows.md)
- [Limites de modulos](docs/architecture/module-boundaries.md)
- [Multi-tenancy](docs/architecture/multi-tenancy.md)
- [Roadmap](docs/delivery/roadmap.md)
- [Constitucion para agentes](AGENTS.md)

## Desarrollo local

Requisitos: Node `24.19.0`, pnpm `11.21.0` y Docker Desktop para levantar PostgreSQL y Mailpit local. La versión canónica de Node vive en `.nvmrc` y `.node-version`; `engine-strict=true` evita validar con otra versión.

```bash
pnpm install
cp .env.example .env.local
openssl rand -base64 32 # pega el resultado solo en BETTER_AUTH_SECRET de .env.local
docker compose up -d postgres postgres-test mailpit
pnpm db:migrate
pnpm dev
```

Visita `http://localhost:3000`, `http://localhost:3000/api/health` y la bandeja local de Mailpit en `http://localhost:8025`.

Para crear una identidad local sin registro publico, cambia temporalmente `AUTH_BOOTSTRAP_ENABLED=true` en `.env.local` y ejecuta `pnpm auth:bootstrap-local`. El script solicita correo, nombre y contrasena sin mostrar esta ultima. Verifica el correo desde Mailpit, prueba login y vuelve a dejar `AUTH_BOOTSTRAP_ENABLED=false`.

Comandos de calidad:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:e2e
pnpm build
```

Para detener los servicios usa `docker compose down`. Los datos locales persisten en volumenes nombrados. Las migraciones usan `DATABASE_MIGRATION_URL`; la aplicacion usa `DATABASE_URL` con privilegios runtime. Oportunidades, pipelines, mensajeria, contenido, proyectos y pagos permanecen fuera de esta fase.

Antes de programar se debe leer la documentacion relevante, verificar el repositorio y explicar cualquier decision que cambie el alcance o la arquitectura.
