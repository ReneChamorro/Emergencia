-- =============================================================
-- Permite que el profesional agende citas de seguimiento (2do/3er
-- contacto) en sus propios casos asignados, dentro de su disponibilidad.
-- Antes de esto, solo el coordinador podia insertar en "appointments".
-- =============================================================

create policy "appts: profesional inserta seguimiento"
  on public.appointments for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.assigned_professional_id = auth.uid()
    )
  );
