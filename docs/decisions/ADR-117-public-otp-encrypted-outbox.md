# ADR-117 Public OTP Encrypted Outbox

## Estado

Aceptada

Los OTP públicos de cotizaciones y acuerdos se generan con HMAC-SHA-256 con una clave obligatoria fuera de `NODE_ENV=test`. El código no se guarda ni se devuelve en claro: el proceso web lo cifra con AES-256-GCM y lo inserta, junto con el cambio de estado OTP, en `public_otp_delivery_jobs` dentro de la misma transacción.

Las funciones PostgreSQL derivan tenant y destinatario desde la sesión pública verificada. Para cotizaciones exigen un contacto activo con email primario y sin `do_not_contact`; para acuerdos usan el snapshot del destinatario. El worker reclama jobs con `FOR UPDATE SKIP LOCKED`, descifra el código sólo al enviar mediante `EmailSender`, y reintenta con lease/backoff.

La solicitud queda limitada a una sesión-capacidad: cinco intentos fallidos bloquean la sesión, hay cooldown de 60 segundos, máximo tres solicitudes por ventana de 15 minutos y dos reenvíos del mismo OTP. `E2E_OTP_PRINT` sólo es válido en runtime de prueba.

SMTP conserva semántica al-menos-una-vez ante una caída entre el envío y el marcado final; el mismo código cifrado se reutiliza en reintentos y reenvíos para que la repetición no cree una credencial distinta.
