# ADR-042: Activación de proyecto con cuatro gates

La activación exige reevaluar en servidor, dentro de la transacción, la
cotización aceptada, el anticipo satisfecho, la aprobación interna ligada al
hash exacto del plan y el acuerdo ejecutado. La UI sólo muestra una proyección
de estos resultados.

Si un adaptador no puede comprobar un gate, el resultado es `unavailable` y el
proyecto no se activa. La aprobación queda ligada a `planHash`; cualquier nueva
versión del plan requiere una nueva aprobación.
