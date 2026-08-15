# ADR-111 Node 24 LTS Runtime

## Contexto

El proyecto requiere Node `24.19.0` y el entorno observado podía ejecutar Node 26.

## Decisión

`.nvmrc` y `.node-version` son referencias canónicas; `package.json`, Docker y CI usan Node 24.19.0. `engine-strict=true` hace fallar instalaciones incompatibles.

## Consecuencias

El desarrollador debe seleccionar Node 24.19.0 antes de instalar dependencias. No se instala un gestor de versiones automáticamente.
