-- Endurecimiento de `public` antes de compartir el proyecto con Mise en Casa.
--
-- 1. `anon` sin ningún permiso: la app nunca lee tablas sin sesión. El RLS ya lo
--    bloqueaba; sin grant es una capa más.
-- 2. `authenticated` solo con select/insert/update/delete. TRUNCATE no respeta RLS,
--    y REFERENCES/TRIGGER no los usa nadie.
-- 3. Las políticas, además del dueño de la fila, exigen que el usuario sea el de
--    finanzas: los usuarios de Mise también son `authenticated`, y con la política
--    vieja podían insertar filas propias en estas tablas.
--
-- No toca el esquema `mise` ni nada fuera de `public`.

-- 1. anon --------------------------------------------------------------------
revoke all on all tables    in schema public from anon;   -- incluye las vistas
revoke all on all sequences in schema public from anon;

alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- 2. authenticated -----------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

-- 3. Políticas solo para el usuario de finanzas -------------------------------
-- `for all` cubre select, insert, update y delete: `using` filtra lo que se lee,
-- actualiza o borra, y `with check` lo que se inserta o actualiza.
do $$
declare t text;
begin
  foreach t in array array['comercios', 'movimientos', 'presupuesto', 'gastos_fijos', 'config', 'compras_cuotas', 'tarjetas']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_propias', t);
    execute format(
      $f$create policy %I on public.%I for all to authenticated
         using      (user_id = auth.uid() and auth.uid() = 'f0586087-896e-4606-8bfe-5cbdc9c80cef'::uuid)
         with check (user_id = auth.uid() and auth.uid() = 'f0586087-896e-4606-8bfe-5cbdc9c80cef'::uuid)$f$,
      t || '_propias', t
    );
  end loop;
end $$;
