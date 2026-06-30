-- =============================================================
-- Disponibilidad semanal de los profesionales
-- Ejecutar despues de 0003_schema_v2.sql
-- =============================================================

-- Dias de la semana: 0=lunes … 6=domingo (igual que getCalendarGrid)
create table public.availability_blocks (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week     int  not null check (day_of_week between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint availability_blocks_times_check check (end_time > start_time)
);

create index availability_blocks_prof_idx on public.availability_blocks (professional_id);
create index availability_blocks_day_idx  on public.availability_blocks (day_of_week);

-- RLS
alter table public.availability_blocks enable row level security;

-- Coordinador: lectura de todos los bloques
create policy "availability: coordinador lee todo"
  on public.availability_blocks for select
  to authenticated
  using (public.is_coordinator());

-- Profesional: lee sus propios bloques
create policy "availability: profesional lee los suyos"
  on public.availability_blocks for select
  to authenticated
  using (professional_id = auth.uid());

-- Profesional: crea sus propios bloques
create policy "availability: profesional inserta los suyos"
  on public.availability_blocks for insert
  to authenticated
  with check (professional_id = auth.uid());

-- Profesional: edita/desactiva sus propios bloques
create policy "availability: profesional actualiza los suyos"
  on public.availability_blocks for update
  to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- Profesional: elimina sus propios bloques
create policy "availability: profesional elimina los suyos"
  on public.availability_blocks for delete
  to authenticated
  using (professional_id = auth.uid());

-- Coordinador: gestion completa
create policy "availability: coordinador gestiona todo"
  on public.availability_blocks for all
  to authenticated
  using (public.is_coordinator())
  with check (public.is_coordinator());
