# Modulos

Todavia no existen modulos de negocio. Cuando se implemente el primero, su limite conceptual sera:

```text
module/
  domain/
  application/
  infrastructure/
  presentation/
```

El dominio no importara React, Next.js, Drizzle, Better Auth ni SDKs externos. Las rutas solo coordinaran casos de uso y validacion de limites.
