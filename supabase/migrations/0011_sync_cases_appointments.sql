-- =============================================================
-- 0011: Sincroniza appointments cuando cambia el profesional de un caso.
--
-- Los 3 flujos de "desasignar" (panel de casos, panel de dia del
-- calendario, autodesasignacion del profesional) solo limpian
-- cases.assigned_professional_id. Las citas "programada" ya creadas
-- para el profesional anterior quedaban intactas, por lo que el
-- calendario seguia mostrandolas como si siguieran vigentes.
--
-- Este trigger cancela automaticamente las citas "programada" del
-- profesional anterior cada vez que assigned_professional_id cambia
-- (a null o a otro profesional), sin importar desde donde se dispare
-- el cambio. Mantiene el panel de casos y el calendario sincronizados.
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
    update public.appointments
    set status = 'cancelada'
    where case_id = NEW.id
      and professional_id = OLD.assigned_professional_id
      and status = 'programada';
  end if;
  return NEW;
end;
$$;

drop trigger if exists cases_cancel_stale_appointments on public.cases;
create trigger cases_cancel_stale_appointments
  after update on public.cases
  for each row execute function public.cancel_stale_appointments_on_reassign();
