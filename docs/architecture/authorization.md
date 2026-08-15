# 🛡️ Autorización (Modelo de Seguridad & Denegación por Defecto)

---

## 🎯 Objetivo de Aprendizaje

Al finalizar la lectura de este documento, serás capaz de:

1. Comprender la diferencia conceptual y técnica entre **Autenticación** y **Autorización**.
2. Explicar el principio de **Denegación por Defecto (Default Deny)** en el servidor.
3. Evaluar cómo se combinan la identidad, la membresía del tenant, el rol y el permiso específico del recurso.

---

## 💡 Modelo Mental y Analogía

> **El Sistema de Seguridad del Pentágono**  
> Piensa en la autorización como la **verificación de nivel de acreditación en una instalación secreta**:
>
> - **Autenticación (Gafete de Identidad)**: Confirma que eres el Agente Juan Pérez (Sabe quién eres).
> - **Membresía del Tenant (Piso asignado)**: Confirma que estás asignado al Sector Norte (La agencia A).
> - **Autorización (Nivel de Seguridad del Archivo)**: Aunque tengas gafete y estés en el Sector Norte, **no puedes abrir el expediente clasificado `contacts.write`** a menos que tu rol contenga ese permiso específico. Si la puerta no te nombra explícitamente, se mantiene CERRADA.

---

## 🗺️ 1. Flujo Evaluador de Autorización en Servidor

```mermaid
flowchart TD
    Req[📥 Petición a Caso de Uso / API] --> AuthCheck{1. Session de Better Auth Valida}
    AuthCheck -- Inválida --> E401[⛔ 401 Unauthorized]

    AuthCheck -- Válida --> MemberCheck{2. Membresía Activa en Tenant}
    MemberCheck -- Sin Membresía --> E404[⛔ 404 Not Found]

    MemberCheck -- Miembro Válido --> PermCheck{3. Permiso en Rol\n(ej. contacts.read)}
    PermCheck -- No tiene permiso --> E403[⛔ 403 Forbidden]

    PermCheck -- Permiso Presente --> ScopeCheck{4. Alcance del Recurso\n(¿Es el propietario o recurso asignado?)}
    ScopeCheck -- Fuera de alcance --> E403

    ScopeCheck -- En alcance --> OK[🟢 Ejecutar Caso de Uso]
```

---

## 🗺️ 2. Estructura de Catálogo de Permisos

El catálogo central utiliza namespaces estrictos por módulo:

- **Directorio Comercial**: `contacts.read`, `contacts.write`, `accounts.read`, `accounts.write`, `tags.manage`.
- **Cotizaciones y Finanzas**: `quotes.read`, `quotes.write`, `quotes.approve`, `payments.record`.
- **Proyectos**: `projects.read`, `projects.write`, `tasks.manage`.
- **Contenido Editorial**: `content.read`, `content.write`, `content.review`, `content.approve`.

### Matriz Sintética de Denegación por Defecto

Cualquier combinación de `(Rol, Permiso)` que no esté explícitamente listada en la matriz de acceso se resuelve como **FALSO (Acceso Denegado)**.

---

## ⚠️ Mitos vs. Realidades / Errores Comunes

| ❌ Mito                                                                                                         | ✅ Realidad                                                                                                                                                           |
| :-------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"Si el servidor retorna el objeto del usuario sin error, la interfaz gráfica debe mostrar todos los menús."** | **Falso.** La interfaz solo consulta la respuesta del servidor para renderizar componentes visuales, pero el servidor vuelve a validar los permisos en cada mutación. |
| **"El `platform_admin` puede leer los contactos y mensajes privados del cliente final."**                       | **Falso.** El administrador de plataforma no tiene permisos automáticos sobre datos tenant-owned. La denegación por defecto aplica para todos los ámbitos.            |

---

## 🧠 Checkpoint de Autocomprobación

1. **¿Qué respuesta recibe un usuario que intenta realizar un cambio sin el permiso `quotes.approve`?**
   - _Respuesta_: Recibe un estado HTTP `403 Forbidden`.

2. **¿Por qué las peticiones de recursos pertenecientes a otro tenant retornan `404 Not Found` en lugar de `403 Forbidden`?**
   - _Respuesta_: Para evitar la divulgación de información (Information Disclosure) y prevenir que atacantes deduzcan IDs válidos de otros clientes.

---

## 🔗 Documentación Relacionada

- [Roles y Permisos](../product/roles-and-permissions.md)
- [Multi-tenancy](multi-tenancy.md)

# Autorizacion en CRM

CRM separa identidad, pertenencia y permiso. Better Auth confirma la identidad y la verificacion de correo; el dominio de tenancy resuelve la membresia activa desde la ruta; la politica RBAC decide el permiso requerido por el caso de uso.

Las rutas API no confian en `tenant_id`, roles ni membership IDs enviados por el navegador. Resuelven el tenant con `resolveTenantContext`, comprueban `requirePermission` y ejecutan queries tenant-owned dentro de `withTenantDatabase`. PostgreSQL aplica RLS como defensa adicional.

La denegacion es el comportamiento predeterminado. Un administrador de plataforma no es un bypass para datos comerciales. El rol `client` solo puede usar el area portal y nunca obtiene acceso al directorio interno.
