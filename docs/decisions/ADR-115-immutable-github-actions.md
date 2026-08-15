# ADR-115 Immutable GitHub Actions

Toda acción externa de CI se fija a un SHA completo de 40 caracteres y conserva comentario de versión. `security:actions` falla ante tags, ramas o SHAs cortos.
