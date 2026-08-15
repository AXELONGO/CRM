# Ingress de integraciones

El endpoint público aplica límite de bytes, lee el body crudo, valida firma y solo después permite normalizar el payload. Las rutas se almacenan como hashes de claves públicas y los verificadores se mantienen cifrados.

El receipt no contiene el payload en texto plano: almacena ciphertext, nonce, tag, hash y versión de clave. Receipt y job se insertan juntos con `tenant_id`; el worker procesa posteriormente bajo RLS.
