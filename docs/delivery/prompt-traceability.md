# Trazabilidad de prompts

## Numeracion disponible

La carpeta de prompts entregada contiene `Prompt_03` a `Prompt_20`. No existe un archivo `Prompt_02`, por lo que su resultado no puede auditarse directamente. La fase base se considera un prerrequisito externo y se valida mediante la aplicacion Next.js, PostgreSQL, Drizzle, Docker, CI y las pruebas del repositorio.

## Orden de ejecucion

Las fases se cierran estrictamente en orden numerico. Una fase posterior no se declara terminada por tener codigo parcial: debe cumplir sus pruebas, migraciones, aislamiento, permisos y criterios de salida.

| Prompt | Alcance                                                                   | Estado inicial                                                       |
| ------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2      | Fase base no entregada                                                    | No auditable                                                         |
| 3      | Autenticacion y sesiones                                                  | Implementado, requiere cierre de cobertura                           |
| 4      | Multitenencia, roles y permisos                                           | Implementado, requiere pruebas de seguridad adicionales              |
| 5      | Directorio comercial                                                      | Implementado, requiere pruebas de aislamiento adicionales            |
| 6      | Oportunidades y pipelines                                                 | Parcial                                                              |
| 7      | Bandeja e integraciones                                                   | Parcial                                                              |
| 8      | Automatizaciones y SLA                                                    | Parcial                                                              |
| 9      | Cotizaciones                                                              | Parcial avanzado                                                     |
| 10     | Contratos y evidencia                                                     | Parcial avanzado                                                     |
| 11-20  | Finanzas, proyectos, portal, contenido, integraciones y hardening         | Pendientes o parciales                                               |
| 21     | Corrección de bloqueadores de runtime, RLS, MFA, restore, CI, carga y UAT | Parcial: controles RLS/CI/load smoke verdes; gates restantes en WAIT |

## Regla de cierre

Cada prompt se marcará como terminado únicamente después de ejecutar sus validaciones específicas y la suite regresiva. No se ejecutan commits, pushes, despliegues ni cambios en servicios externos durante este trabajo.
