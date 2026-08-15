# ADR-001: Monolito modular

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

El equipo inicial es una persona principiante con apoyo de IA y el presupuesto de pilotos es limitado. Hay muchos dominios conectados, pero no necesidad de despliegues independientes.

## Decision

Construir un monolito modular con limites explicitos entre dominio, casos de uso, infraestructura e interfaz. Separar modulos en codigo y dependencias, no en servicios desplegables.

## Consecuencias positivas

Menor costo, depuracion sencilla, transacciones directas y desarrollo vertical.

## Costos/riesgos

Un despliegue puede afectar varios modulos y los limites pueden degradarse sin revision.

## Alternativas descartadas

Microservicios, Kubernetes y event streaming desde el MVP.

## Condiciones de revision

Revisar si un modulo requiere escalado, seguridad, despliegue o disponibilidad independiente demostrable.
