-- =============================================================
-- Marca cuando el profesional asignado ve el caso por primera vez
-- en su panel ("Mis casos"), para poder mostrarle una marca de
-- "Nuevo" solo hasta que lo vea. Se limpia automaticamente si el
-- caso se reasigna a otro profesional, para que a este tambien le
-- aparezca como nuevo.
-- =============================================================

alter table public.cases
  add column first_viewed_at timestamptz;

create or replace function public.reset_first_viewed_on_reassign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.assigned_professional_id is distinct from OLD.assigned_professional_id then
    NEW.first_viewed_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists cases_reset_first_viewed on public.cases;
create trigger cases_reset_first_viewed
  before update on public.cases
  for each row execute function public.reset_first_viewed_on_reassign();
