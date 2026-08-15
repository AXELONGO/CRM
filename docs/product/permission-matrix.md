# Matriz de permisos

La autorizacion se evalua en servidor despues de resolver identidad, tenant y membresia. Todo permiso no listado se deniega.

| Rol              | Alcance real                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `platform_admin` | Crear, consultar y suspender tenants desde plataforma; no accede automaticamente a datos internos |
| `tenant_admin`   | Permisos tenant del catalogo, membresias, invitaciones, configuracion y auditoria                 |
| `sales`          | Directorio, oportunidades, actividades, pipelines de lectura, inbox y cotizaciones segun catalogo |
| `execution`      | Lectura operativa, notas propias y seguimiento permitido; sin administracion                      |
| `finance`        | Lectura operativa y acceso futuro financiero segun su modulo; sin administracion general          |
| `client`         | Solo `tenant.view` en el area portal; no accede al area interna ni notas privadas                 |

## Reglas

- Un administrador de plataforma sin membresia no entra a un tenant.
- `client` no se combina con roles internos.
- Tenant o membresia suspendidos deniegan solicitudes posteriores.
- Los permisos de modulos futuros se definen en sus propios prompts y no se conceden implicitamente.
