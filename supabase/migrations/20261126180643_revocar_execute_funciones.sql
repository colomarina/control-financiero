-- Las funciones que se creen en `public` (como postgres) ya no nacen ejecutables
-- por `anon` ni por PUBLIC: hay que darles `grant execute` a propósito.
-- Hoy `public` no tiene funciones; esto cubre las que vengan.
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;
