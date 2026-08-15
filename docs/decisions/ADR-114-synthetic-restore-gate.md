# ADR-114 Synthetic Restore Gate

El restore drill válido debe usar PostgreSQL real, `pg_dump`, `pg_restore`, storage privado local y recursos con identificadores propios. El snapshot JSON heredado no cuenta como evidencia de restore.
