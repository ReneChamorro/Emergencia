-- =============================================================
-- Endurecimiento de seguridad (idempotente).
-- Ejecutar DESPUES de 0001_init.sql. Seguro de re-ejecutar.
-- =============================================================

-- ---------- 1. Restricciones de longitud / rango en cases ----------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cases_name_len') then
    alter table public.cases add constraint cases_name_len
      check (char_length(patient_name) between 2 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cases_age_range') then
    alter table public.cases add constraint cases_age_range
      check (patient_age is null or patient_age between 0 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cases_whatsapp_fmt') then
    alter table public.cases add constraint cases_whatsapp_fmt
      check (whatsapp ~ '^\+?[0-9]{7,15}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cases_city_len') then
    alter table public.cases add constraint cases_city_len
      check (city is null or char_length(city) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cases_email_len') then
    alter table public.cases add constraint cases_email_len
      check (email is null or char_length(email) <= 150);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cases_availability_len') then
    alter table public.cases add constraint cases_availability_len
      check (availability is null or char_length(availability) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cases_observations_len') then
    alter table public.cases add constraint cases_observations_len
      check (observations is null or char_length(observations) <= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cases_notes_len') then
    alter table public.cases add constraint cases_notes_len
      check (notes is null or char_length(notes) <= 5000);
  end if;
end $$;

-- ---------- 2. Trigger anti escalada de privilegios ----------
create or replace function public.prevent_profile_privilege_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.active is distinct from old.active)
     and not public.is_coordinator() then
    raise exception 'No autorizado para cambiar el rol o el estado de la cuenta';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_priv on public.profiles;
create trigger trg_prevent_profile_priv
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_change();

-- ---------- 3. Freno de abuso en el agendamiento ----------
-- Max 5 solicitudes por numero de WhatsApp por hora.
create or replace function public.limit_intake_rate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.cases
    where whatsapp = new.whatsapp
      and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Demasiadas solicitudes desde este numero. Intenta mas tarde.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limit_intake_rate on public.cases;
create trigger trg_limit_intake_rate
  before insert on public.cases
  for each row execute function public.limit_intake_rate();

-- =============================================================
-- Para promover al primer coordinador (ejecutar una vez):
--
--   update public.profiles
--   set role = 'coordinator'
--   where id = (select id from auth.users where email = 'TU-CORREO@ejemplo.com');
-- =============================================================
