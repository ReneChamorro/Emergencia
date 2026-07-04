-- =============================================================
-- 0012: Al desasignar/reasignar un caso, BORRAR (no solo cancelar)
--       las citas "programada" del profesional anterior.
--
-- La 0011 cambiaba el estado a "cancelada", pero el calendario sigue
-- mostrando las citas canceladas, por lo que la cita no desaparecia al
-- desasignar. Aqui las borramos directamente: la cita del profesional
-- anterior deja de existir y desaparece del calendario.
--
-- Solo afecta citas "programada" (futuras/pendientes). Las citas
-- "realizada" (contactos ya efectuados) se conservan como historial.
-- =============================================================

create or replace function public.cancel_stale_appointments_on_reassign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.assigned_professional_id is not null
     and NEW.assigned_professional_id is distinct from OLD.assigned_professional_id
  then
    delete from public.appointments
    where case_id = NEW.id
      and professional_id = OLD.assigned_professional_id
      and status = 'programada';
  end if;
  return NEW;
end;
$$;

-- El trigger cases_cancel_stale_appointments (creado en 0011) ya apunta a
-- esta función; al redefinirla con CREATE OR REPLACE queda actualizado.
