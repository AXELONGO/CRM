# Constitucion de trabajo para agentes

Estas reglas aplican a cualquier agente que trabaje en este repositorio.

## Antes de editar

- Leer `README.md`, `docs/README.md` y los documentos relevantes del cambio.
- Inspeccionar el repositorio antes de asumir lenguaje, framework, base de datos o autenticacion.
- Ejecutar `git status` y revisar cambios existentes.
- No sobrescribir ni eliminar trabajo ajeno.
- Confirmar el alcance solicitado antes de crear archivos o dependencias.

## Cambios

- Hacer cambios pequenos, enfocados y verificables.
- No modificar fuera del alcance solicitado.
- No introducir dependencias sin justificar necesidad, mantenimiento, licencia, alternativa y costo.
- Mantener los limites del monolito modular.
- Toda entidad de negocio debe respetar `tenant_id` y permisos del recurso.
- Las integraciones externas deben pasar por puertos y adaptadores.
- Las migraciones deben ser versionadas y no deben borrar datos sin autorizacion explicita.
- Los cambios de datos deben incluir pruebas de aislamiento multiempresa.

## Seguridad

- Nunca exponer secretos, tokens, credenciales o datos personales en Git, logs, respuestas o capturas.
- No confiar en un `tenant_id` enviado por el cliente; derivarlo del contexto autenticado.
- Validar autenticacion, pertenencia al tenant, rol y alcance del recurso en backend.
- Verificar firmas e idempotencia de webhooks.
- Mantener archivos fuera de la base de datos y sus permisos dentro de PostgreSQL.

## Verificacion

- Probar antes de declarar una tarea terminada.
- Actualizar documentacion y ADR cuando cambie una decision.
- Informar archivos modificados, pruebas, limitaciones y riesgos.
- Verificar estados de carga, vacio, error y accesibilidad en interfaces.
- Explicar al propietario cualquier comando destructivo o peligroso antes de proponerlo.

## Git y despliegues

- No hacer `commit`, `push`, `merge`, despliegue ni cambios externos salvo peticion explicita.
- No usar comandos destructivos para ocultar cambios.
- Antes de cualquier commit solicitado, revisar status y diff completo.
