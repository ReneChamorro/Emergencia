-- =============================================================
-- App de apoyo psicologico de emergencia post-terremoto
-- Esquema inicial: profiles, cases, appointments, case_events
-- =============================================================

-- ---------- Tipos enumerados ----------
create type user_role       as enum ('coordinator', 'professional');
create type urgency_level   as enum ('alta', 'media', 'baja');
create type case_status     as enum ('nuevo', 'asignado', 'en_contacto', 'cerrado', 'derivado');
create type appt_modality   as enum ('llamada', 'videollamada', 'presencial');
create type appt_status     as enum ('programada', 'realizada', 'cancelada', 'no_asistio');
create type pref_modality   as enum ('videollamada', 'llamada', 'whatsapp_audio', 'cualquiera');
create type stable_conn     as enum ('si', 'no', 'a_veces');

-- ---------- profiles (extiende auth.users) ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        user_role not null default 'professional',
  specialty   text,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- cases (solicitudes de agendamiento) ----------
create table public.cases (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- Datos del paciente
  patient_name  text not null,
  patient_age   int,
  city          text,
  whatsapp      text not null,
  email         text,

  -- Modalidad y conectividad
  preferred_modality  pref_modality not null default 'cualquiera',
  has_stable_conn     stable_conn,

  -- Disponibilidad
  available_days   text,        -- p.ej. "Lunes,Miercoles,Viernes"
  available_times  text,        -- p.ej. "Tarde,Noche"
  availability     text,        -- texto libre de horarios especificos

  -- Observaciones para la agenda
  observations  text,

  -- Gestion
  urgency                   urgency_level not null default 'media',
  consent                   boolean not null default false,
  status                    case_status not null default 'nuevo',
  assigned_professional_id  uuid references public.profiles (id) on delete set null,
  notes                     text
);

create index cases_status_idx   on public.cases (status);
create index cases_urgency_idx  on public.cases (urgency);
create index cases_assigned_idx on public.cases (assigned_professional_id);
create index cases_created_idx  on public.cases (created_at desc);

-- ---------- appointments ----------
create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.cases (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete cascade,
  scheduled_at    timestamptz not null,
  modality        appt_modality not null default 'videollamada',
  status          appt_status not null default 'programada',
  contact_number  int not null default 1 check (contact_number between 1 and 3),
  notes           text,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index appointments_case_idx on public.appointments (case_id);
create index appointments_prof_idx on public.appointments (professional_id);
create index appointments_when_idx on public.appointments (scheduled_at);

-- ---------- case_events (auditoria ligera) ----------
create table public.case_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.cases (id) on delete cascade,
  event_type  text not null,
  detail      text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index case_events_case_idx on public.case_events (case_id, created_at desc);

-- =============================================================
-- Helpers de rol (SECURITY DEFINER para evitar recursion de RLS)
-- =============================================================
create or replace function public.is_coordinator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coordinator' and active
  );
$$;

-- =============================================================
-- Trigger: crear profile al registrarse un usuario.
-- Todas las cuentas nacen como 'professional'.
-- Un coordinador promueve manualmente al primer coordinador (ver README).
-- =============================================================
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.profiles    enable row level security;
alter table public.cases       enable row level security;
alter table public.appointments enable row level security;
alter table public.case_events  enable row level security;

-- ----- profiles -----
create policy "profiles: lectura propia o coordinador"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_coordinator());

create policy "profiles: actualizar el propio"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: coordinador gestiona todos"
  on public.profiles for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

-- ----- cases -----
-- AGENDAMIENTO PUBLICO: anon puede insertar, solo campos de agenda.
create policy "cases: agendamiento publico (insert anon)"
  on public.cases for insert
  to anon
  with check (
    consent = true
    and status = 'nuevo'
    and assigned_professional_id is null
    and notes is null
  );

create policy "cases: coordinador lee todo"
  on public.cases for select
  to authenticated
  using (public.is_coordinator());

create policy "cases: coordinador modifica todo"
  on public.cases for update
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());

create policy "cases: coordinador inserta"
  on public.cases for insert
  to authenticated
  with check (public.is_coordinator());

create policy "cases: profesional ve los suyos"
  on public.cases for select
  to authenticated
  using (assigned_professional_id = auth.uid());

create policy "cases: profesional actualiza los suyos"
  on public.cases for update
  to authenticated
  using (assigned_professional_id = auth.uid())
  with check (assigned_professional_id = auth.uid());

-- ----- appointments -----
create policy "appts: coordinador (select)"  on public.appointments for select to authenticated using (public.is_coordinator());
create policy "appts: coordinador (insert)"  on public.appointments for insert to authenticated with check (public.is_coordinator());
create policy "appts: coordinador (update)"  on public.appointments for update to authenticated using (public.is_coordinator()) with check (public.is_coordinator());
create policy "appts: coordinador (delete)"  on public.appointments for delete to authenticated using (public.is_coordinator());
create policy "appts: profesional ve los suyos"       on public.appointments for select to authenticated using (professional_id = auth.uid());
create policy "appts: profesional actualiza los suyos" on public.appointments for update to authenticated using (professional_id = auth.uid()) with check (professional_id = auth.uid());

-- ----- case_events -----
create policy "events: coordinador lee todo"
  on public.case_events for select
  to authenticated
  using (public.is_coordinator());

create policy "events: profesional lee de sus casos"
  on public.case_events for select
  to authenticated
  using (
    exists (select 1 from public.cases c
      where c.id = case_events.case_id
        and c.assigned_professional_id = auth.uid())
  );

create policy "events: inserta en casos propios o coordinador"
  on public.case_events for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (
      public.is_coordinator()
      or exists (select 1 from public.cases c
        where c.id = case_id
          and c.assigned_professional_id = auth.uid())
    )
  );
