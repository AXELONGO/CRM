# ADR-010: Despliegue y costo del piloto

## Estado

Aceptada

## Fecha

2026-08-10

## Contexto

El equipo inicial es pequeno y el presupuesto maximo de infraestructura para pilotos es de 500 MXN mensuales. Se necesita un despliegue Node/Docker simple sin prometer capacidades ilimitadas.

## Decision

El objetivo inicial es Railway Hobby para la aplicacion Docker, un proveedor administrado de PostgreSQL y un proveedor de almacenamiento privado compatible con el puerto definido por CRM. Docker Compose se usara para PostgreSQL local. WAHA, cuando se use, sera un servicio opcional separado y su consumo se medira.

Railway Hobby admite un numero limitado de dominios personalizados por servicio. La configuracion inicial puede cubrir el dominio de plataforma y hasta dos dominios personalizados de agencias. Antes de una tercera agencia con dominio propio se evaluara Railway Pro, un proxy SaaS compatible o un VPS administrado.

Meta Cloud API no requiere mantener una sesion de WhatsApp dentro del servidor principal. Los respaldos del proveedor elegido deben resolverse con exportacion programada antes de datos piloto irreemplazables.

## Consecuencias positivas

Costo y operacion reducidos, un contenedor principal y una ruta clara para reevaluar limites.

## Costos y riesgos

Los planes iniciales pueden tener limites, pausas y respaldos restringidos. Dominios, WAHA, PostgreSQL y almacenamiento pueden superar el presupuesto.

## Alternativas consideradas

Kubernetes, VPS desde el inicio, microservicios y un proxy dedicado antes de conocer el uso real.

## Condiciones de revision

Revisar con consumo, numero de tenants, dominios, disponibilidad y costos medidos del piloto.

## Referencias

- https://docs.railway.com/reference/pricing
