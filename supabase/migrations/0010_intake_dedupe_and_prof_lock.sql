-- =============================================================
-- 0010: Anti-duplicados en el intake + bloqueo de profesional.
--
-- 1) case_exists(): permite al formulario público (anon) comprobar si ya
--    existe un caso ACTIVO (no cerrado/derivado) con el mismo nombre y
--    teléfono, sin exponer SELECT sobre cases (RLS). SECURITY DEFINER.
-- 2) Índice único parcial como backstop contra carreras.
-- 3) enforce_professional_lock(): una vez que un caso tiene una 2.ª cita
--    (contact_number >= 2), no se puede reasignar a otro profesional.
-- =============================================================

-- ---------- 1. Comprobación de duplicados (anon) ----------
create or replace function public.case_exists(p_name text, p_whatsapp text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cases
    where lower(btrim(patient_name)) = lower(btrim(p_name))
      and regexp_replace(whatsapp, '\D', '', 'g') = regexp_replace(p_whatsapp, '\D', '', 'g')
      and status not in ('cerrado', 'derivado')
  );
$$;

grant execute on function public.case_exists(text, text) to anon, authenticated;

-- ---------- 2. Backstop contra carreras ----------
-- Puede fallar si ya existen duplicados activos: limpiarlos y reintentar.
create unique index if not exists cases_active_person_uniq
  on public.cases (lower(btrim(patient_name)), regexp_replace(whatsapp, '\D', '', 'g'))
  where status not in ('cerrado', 'derivado');

-- ---------- 3. Bloqueo de profesional tras la 2.ª cita ----------
create or replace function public.enforce_professional_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.assigned_professional_id is not null
     and NEW.assigned_professional_id is distinct from OLD.assigned_professional_id
     and NEW.assigned_professional_id is not null
     and exists (
       select 1 from public.appointments a
       where a.case_id = OLD.id and a.contact_number >= 2
     )
  then
    raise exception 'No se puede cambiar de profesional: el caso ya tiene una segunda cita agendada.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists cases_professional_lock on public.cases;
create trigger cases_professional_lock
  before update on public.cases
  for each row execute function public.enforce_professional_lock();
