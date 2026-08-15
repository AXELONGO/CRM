# MFA Policy

CRM usa el plugin oficial `twoFactor` de Better Auth con TOTP y códigos de recuperación cifrados por el adaptador. `skipVerificationOnEnable=false`, `trustDevice=false` y `MFA_ENFORCEMENT_ENABLED=true` son obligatorios para el piloto.

## Alcance

La política exige MFA a usuarios con rol de plataforma, `tenant_admin` o `finance` en cualquier membresía activa. La evaluación es por usuario, no por tenant seleccionado. El plugin conserva rate limiting y bloqueo de intentos; los secretos y códigos nunca se escriben en logs.

## Recuperación

Los códigos de recuperación sólo se muestran durante inscripción/regeneración. La recuperación humana requiere verificación de identidad por el responsable del sistema, revocación de sesiones y nueva inscripción. No existe bypass técnico ni lectura administrativa de secretos.

## Evidencia pendiente

- `WAIT-MFA-E2E`: la política, plugin oficial, migración, guard y pruebas unitarias están verdes; falta ejecutar con una cuenta sintética privilegiada la inscripción, TOTP válido/inválido, código consumido, revocación de sesiones y bloqueo de acceso directo a API.
- `WAIT-HUMAN-BREAK-GLASS`: falta aprobación del procedimiento operativo por el propietario.
