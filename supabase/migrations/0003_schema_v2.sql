-- =============================================================
-- Migracion v2: actualiza cases al esquema de agendamiento humanitario.
-- Ejecutar si ya aplicaste el 0001 original (con campos de triaje).
-- Luego corre 0002_security.sql.
-- =============================================================

-- Nuevos tipos enumerados
do $$ begin
  create type pref_modality as enum ('videollamada','llamada','whatsapp_audio','cualquiera');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stable_conn as enum ('si','no','a_veces');
exception when duplicate_object then null; end $$;

-- Agregar columnas nuevas (si no existen)
alter table public.cases
  add column if not exists email               text,
  add column if not exists preferred_modality  pref_modality not null default 'cualquiera',
  add column if not exists has_stable_conn     stable_conn,
  add column if not exists available_days      text,
  add column if not exists available_times     text,
  add column if not exists observations        text;

-- Eliminar columnas de triaje clinico (ya no se usan)
alter table public.cases
  drop column if exists in_danger,
  drop column if exists self_harm_ideation,
  drop column if exists is_alone,
  drop column if exists lost_family_home,
  drop column if exists main_reason;

-- Actualizar la politica de intake anonimo al nuevo esquema
drop policy if exists "cases: intake publico (insert anon)" on public.cases;
create policy "cases: agendamiento publico (insert anon)"
  on public.cases for insert
  to anon
  with check (
    consent = true
    and status = 'nuevo'
    and assigned_professional_id is null
    and notes is null
  );
