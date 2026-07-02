-- =============================================================
-- 0009: Política de DELETE para cases.
--
-- La migración 0001 creó políticas de INSERT/SELECT/UPDATE para
-- public.cases pero NO una de DELETE. Con RLS activo y sin política,
-- Postgres niega el borrado en silencio (0 filas, sin error), por lo
-- que el botón "Eliminar caso" del panel de coordinación no hacía nada.
--
-- is_coordinator() cubre 'coordinator' + 'admin' (migración 0008).
-- appointments y case_events tienen ON DELETE CASCADE, así que se
-- borran automáticamente al eliminar el caso.
-- =============================================================

create policy "cases: coordinador elimina"
  on public.cases for delete
  to authenticated
  using (public.is_coordinator());
