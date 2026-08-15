# ADR-003: Multi-tenancy desde el primer esquema

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

Cada empresa debe ser independiente y el sistema debe crecer como SaaS sin duplicar aplicaciones.

## Decision

Usar aislamiento logico compartido inicialmente. Cada entidad de negocio tendra `tenant_id`; la autorizacion combinara tenant, rol y alcance; el dominio resolvera tenant por hostname verificado o contexto autenticado.

## Consecuencias positivas

Un solo nucleo, menor costo, white-label y pruebas de aislamiento desde el inicio.

## Costos/riesgos

Un filtro omitido puede causar una fuga grave. RLS, joins, archivos, logs y exports requieren pruebas especificas.

## Alternativas descartadas

Una aplicacion o base fisica por empresa en el MVP.

## Condiciones de revision

Revisar si aparecen requisitos regulatorios, volumen o clientes que justifiquen aislamiento fisico.
