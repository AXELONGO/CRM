# 🔒 Aislamiento de Datos Comerciales (PostgreSQL RLS & Drizzle)

---

## 🎯 Objetivo de Aprendizaje

Al finalizar la lectura de este documento, serás capaz de:

1. Comprender la implementación técnica de **Row Level Security (RLS)** en PostgreSQL con Drizzle ORM.
2. Configurar la función helper `withTenantDatabase` para garantizar transacciones aisladas.
3. Escribir consultas seguras a la base de datos respetando las claves compuestas y políticas de aislamiento.

---

## 💡 Modelo Mental y Analogía

> **El Guardia de Seguridad Privado dentro del Archivador**  
> Imagina que la base de datos es un **archivador lleno de expedientes de clientes**:
>
> - Sin RLS, el repositorio de código tendría que acordarse manualmente de revisar la etiqueta del expediente antes de entregárselo al usuario. Si el programador olvida verificar, hay fuga de información.
> - **Con RLS**, hay un **guardia de seguridad inquebrantable dentro del archivador**. Antes de entregar cualquier expediente, el guardia verifica la credencial temporal dada por la transacción (`app.current_tenant_id`). Si el expediente pertenece a otra empresa, el guardia actúa como si ese documento no existiera.

---

## 🗺️ 1. Flujo de Ejecución de Transacción RLS

```mermaid
flowchart TD
    Req[📥 Petición HTTP recibida] --> Session[🔑 Resolver Sesión & TenantSlug]
    Session --> Guard{¿Tenant Activo Validador?}

    Guard -- No --> Deny[⛔ Retornar Error 401/403]
    Guard -- Sí --> Helper[⚙️ Ejecutar `withTenantDatabase(tenantId, fn)`]

    subgraph Transaction["🐘 Transacción PostgreSQL (SET LOCAL)"]
        Helper --> SetConfig["1. SET LOCAL app.current_tenant_id = 'uuid-tenant'"]
        SetConfig --> ExecuteQuery["2. Query Drizzle ORM (SELECT / INSERT / UPDATE)"]
        ExecuteQuery --> RLSPolicy{"3. Evaluacion de Politica RLS\n(tenant_id = current_setting('app.current_tenant_id'))"}
        RLSPolicy -- Coincide --> Result["🟢 Operación Exitosa"]
        RLSPolicy -- No coincide --> FilterOut["🚫 Fila Ocultada / Rechazada"]
    end

    Result --> Res[📤 Respuesta JSON al Cliente]
```

---

## 🗺️ 2. Estructura de Tablas y Claves Compuestas

Para mantener la máxima integridad de los datos en el directorio comercial y módulos de negocio, las tablas utilizan claves compuestas que incluyen la columna `tenant_id`:

```sql
-- Ejemplo de Definición SQL de Tabla de Contactos con RLS
CREATE TABLE contacts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
);

-- Habilitar RLS estricto (incluso para el owner de la tabla)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

-- Política de RLS para Aislamiento Multi-tenant
CREATE POLICY contacts_tenant_isolation_policy ON contacts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

---

## 🗺️ 3. Implementación Segura en Código (Drizzle ORM)

### ❌ Forma Incorrecta (Insegura)

```typescript
// 🔴 NUNCA hacer esto: No abre contexto de transacción con tenant SET LOCAL
export async function getContactsUnsafe() {
  return await db.select().from(contacts); // Fuga de datos potencial si RLS no está activo
}
```

### ✅ Forma Correcta (Segura)

```typescript
// 🟢 FORMA CORRECTA: Usa el wrapper con transaccionalidad aislada
export async function getContactsSafe(tenantId: string) {
  return await withTenantDatabase(tenantId, async (tx) => {
    return await tx.select().from(contacts).where(eq(contacts.tenantId, tenantId));
  });
}
```

---

## ⚠️ Mitos vs. Realidades / Errores Comunes

| ❌ Mito                                                                                                       | ✅ Realidad                                                                                                                                   |
| :------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| **"Si un hacker obtiene acceso al cliente frontend, puede modificar las políticas RLS de la base de datos."** | **Falso.** El usuario de la aplicación (`crm_runtime`) no tiene permisos DDL ni superusuario para alterar políticas o roles de PostgreSQL.    |
| **"Las respuestas a peticiones cross-tenant retornan un error 403 con el mensaje 'Acceso Denegado'."**        | **Falso.** Para evitar revelar la existencia de recursos de otras empresas, las peticiones cross-tenant retornan un estado **404 Not Found**. |

---

## 🧠 Checkpoint de Autocomprobación

1. **¿Qué comando de PostgreSQL garantiza que la regla de RLS se aplique incluso para el creador o propietario de la tabla?**
   - _Respuesta_: `ALTER TABLE nombre_tabla FORCE ROW LEVEL SECURITY;`

2. **¿Por qué se utiliza `SET LOCAL` en lugar de `SET` global dentro de la función `withTenantDatabase`?**
   - _Respuesta_: Porque `SET LOCAL` restringe la variable `app.current_tenant_id` únicamente a la transacción actual, evitando que otras peticiones concurrentes en el mismo pool de conexiones reutilicen el tenant de otra sesión.

---

## 🔗 Documentación Relacionada

- [Multi-tenancy](multi-tenancy.md)
- [ADR-015 RLS para Datos del Tenant](../decisions/ADR-015-rls-for-tenant-business-data.md)
