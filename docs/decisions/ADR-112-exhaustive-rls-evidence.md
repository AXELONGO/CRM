# ADR-112 Exhaustive RLS Evidence

El catálogo RLS se obtiene desde PostgreSQL, no desde mocks. `security:rls-audit` exige RLS + FORCE RLS, políticas por operación y roles runtime sin superusuario ni `BYPASSRLS`. La migración `0029_rls_prompt21.sql` corrige las tablas tenant detectadas sin política efectiva.
