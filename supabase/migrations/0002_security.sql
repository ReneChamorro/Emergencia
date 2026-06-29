-- =============================================================
-- Endurecimiento de seguridad (idempotente).
-- Ejecutar DESPUES de 0001_init.sql. Seguro de re-ejecutar.
--
-- Corrige:
--  1. Escalada de privilegios: un profesional podia ascenderse a coordinador
--     actualizando su propio profile.
--  2. Fuga de PII: cualquier usuario autenticado leia TODOS los profiles
--     (telefonos, especialidad) de los voluntarios.
--  3. Intake anonimo podia fijar status/asignacion/notas (pre-cerrar casos,
--     auto-asignarse, inyectar notas).
--  4. Sin limites de longitud/rango -> abuso de almacenamiento / payloads enormes.
--  5. Bootstrap inseguro: el primer registro se volvia coordinador (riesgo de
--     que un atacante tome el rol admin al desplegar).
-- =============================================================

-- ---------- 1. Restricciones de longitud / rango en cases ----------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cases_name_len') then
    alter table public.cases
      add constraint cases_name_len
      check (char_length(patient_name) between 2 and 120);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cases_age_range') then
    alter table public.cases
      add constraint cases_age_range
      check (patient_age is null or (patient_age between 0 and 120));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cases_whatsapp_fmt') then
    alter table public.cases
      add constraint cases_whatsapp_fmt
      check (whatsapp ~ '^\+?[0-9]{7,15}$');
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cases_city_len') then
    alter table public.cases
      add constraint cases_city_len
      check (city is null or char_length(city) <= 80);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cases_reason_len') then
    alter table public.cases
      add constraint cases_reason_len
      check (char_length(main_reason) between 3 and 2000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cases_availability_len') then
    alter table public.cases
      add constraint cases_availability_len
      check (availability is null or char_length(availability) <= 300);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'cases_notes_len') then
    alter table public.cases
      add constraint cases_notes_len
      check (notes is null or char_length(notes) <= 5000);
  end if;
end $$;

-- ---------- 2. Intake anonimo restringido ----------
-- El anonimo solo puede crear casos "nuevos", sin asignar y sin notas.
drop policy if exists "cases: intake publico (insert anon)" on public.cases;
create policy "cases: intake publico (insert anon)"
  on public.cases for insert
  to anon
  with check (
    consent = true
    and status = 'nuevo'
    and assigned_professional_id is null
    and notes is null
  );

-- ---------- 3. profiles: lectura restringida (anti fuga de PII) ----------
drop policy if exists "profiles: lectura autenticada" on public.profiles;
drop policy if exists "profiles: lectura propia o coordinador" on public.profiles;
create policy "profiles: lectura propia o coordinador"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_coordinator());

-- ---------- 4. Evitar escalada de privilegios en profiles ----------
-- Un usuario no-coordinador no puede cambiar su propio rol ni su estado activo.
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

-- ---------- 5. Bootstrap seguro: todos entran como 'professional' ----------
-- Ya NO se asigna coordinador automaticamente. Promueve manualmente al primer
-- coordinador (ver README / snippet al final).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'professional'::user_role
  );
  return new;
end;
$$;

-- ---------- 6. case_events: insertar solo en casos propios o como coordinador ----------
drop policy if exists "events: autenticado inserta" on public.case_events;
drop policy if exists "events: inserta en casos propios o coordinador" on public.case_events;
create policy "events: inserta en casos propios o coordinador"
  on public.case_events for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_coordinator()
      or exists (
        select 1 from public.cases c
        where c.id = case_id
          and c.assigned_professional_id = auth.uid()
      )
    )
  );

-- ---------- 7. Eliminar funcion sin uso que sombrea un builtin ----------
drop function if exists public.current_role();

-- ---------- 8. Freno basico de abuso en el intake ----------
-- Limita a 5 solicitudes por numero de WhatsApp por hora. No sustituye un
-- CAPTCHA/rate-limit por IP (ver notas de seguridad del README), pero evita el
-- flooding trivial y los envios duplicados accidentales.
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
-- Promover al primer coordinador (ejecutar una vez, con tu correo):
--
--   update public.profiles
--   set role = 'coordinator'
--   where id = (select id from auth.users where email = 'TU-CORREO@ejemplo.com');
--
-- Recomendado tambien: en Authentication -> Providers -> Email, considerar
-- desactivar el registro publico una vez creado el equipo, o exigir
-- confirmacion por correo.
-- =============================================================
