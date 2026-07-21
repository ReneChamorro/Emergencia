-- =============================================================
-- Limite de consultas activas por profesional. Cada profesional puede
-- fijar cuantos casos activos (no cerrados/derivados) esta dispuesto a
-- llevar a la vez. null = sin limite (por defecto).
--
-- Si un profesional baja su limite por debajo de los casos que ya
-- tiene asignados, esos casos existentes NO se tocan (quedan como
-- excepcion); el limite solo bloquea NUEVAS asignaciones mientras este
-- en o por encima del limite.
-- =============================================================

alter table public.profiles
  add column max_active_cases int;

alter table public.profiles
  add constraint profiles_max_active_cases_positive
  check (max_active_cases is null or max_active_cases > 0);

create or replace function public.enforce_active_case_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_cases int;
  active_count int;
begin
  -- Solo aplica cuando el caso queda con un profesional asignado y esa
  -- asignacion es nueva (alta con profesional, o reasignacion). Si no
  -- cambia el profesional (ej. el coordinador solo edita notas/estado),
  -- no se re-evalua el limite.
  if NEW.assigned_professional_id is null then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and NEW.assigned_professional_id is not distinct from OLD.assigned_professional_id then
    return NEW;
  end if;

  select max_active_cases into max_cases
  from public.profiles
  where id = NEW.assigned_professional_id;

  if max_cases is null then
    return NEW;
  end if;

  select count(*) into active_count
  from public.cases
  where assigned_professional_id = NEW.assigned_professional_id
    and status not in ('cerrado', 'derivado')
    and id is distinct from NEW.id;

  if active_count >= max_cases then
    raise exception 'Este profesional ya alcanzo su limite de % consultas activas.', max_cases;
  end if;

  return NEW;
end;
$$;

drop trigger if exists cases_enforce_active_limit on public.cases;
create trigger cases_enforce_active_limit
  before insert or update on public.cases
  for each row execute function public.enforce_active_case_limit();
