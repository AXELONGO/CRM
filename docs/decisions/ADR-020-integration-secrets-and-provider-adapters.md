# ADR-020: Secretos de integraciones y adaptadores

## Estado

Aceptada

Los secretos de cada conexión se cifran con AES-256-GCM, fingerprint y versión de clave. El cliente nunca recibe el valor secreto. Las rutas públicas solo pueden resolver una ruta activa por hash de clave pública; el worker descifra con la versión persistida del receipt.

Meta, WAHA, formularios y futuros proveedores implementan puertos de adaptador. Las capacidades del canal se declaran explícitamente para bloquear respuestas fuera de ventana o tipos no soportados.
