-- =============================================================
-- 0015: Consultas grupales.
--
-- Funcionan igual que las individuales: cada paciente sigue teniendo su
-- propia fila en appointments (mismo estado, mensaje de WhatsApp, contacto
-- 1/3, etc.) — lo unico nuevo es que hasta 10 filas pueden compartir el
-- mismo (professional_id, scheduled_at) cuando el bloque de disponibilidad
-- de origen es de tipo grupal.
--
-- is_group en availability_blocks: el profesional marca el bloque como
-- "consulta grupal" al crearlo (en vez de individual, que sigue siendo el
-- default). Los horarios generados desde ese bloque heredan is_group=true.
--
-- is_group en appointments: se copia del bloque al momento de agendar.
-- Un trigger BEFORE INSERT valida:
--   - slot vacio -> siempre permitido (establece el tipo del slot).
--   - slot con citas "programada" existentes:
--       - si son de tipo distinto al nuevo -> rechazado (no se puede
--         mezclar individual y grupal en el mismo horario).
--       - si son individuales -> rechazado (el horario ya esta ocupado).
--       - si son grupales y ya hay 10 -> rechazado (cupo lleno).
--       - si son grupales y hay cupo -> permitido.
-- =============================================================

alter table public.availability_blocks
  add column is_group boolean not null default false;

alter table public.appointments
  add column is_group boolean not null default false;

create or replace function public.enforce_appointment_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count int;
  existing_is_group boolean;
begin
  select count(*), bool_and(is_group) into existing_count, existing_is_group
  from public.appointments
  where professional_id = new.professional_id
    and scheduled_at = new.scheduled_at
    and status = 'programada';

  if existing_count = 0 then
    return new;
  end if;

  if existing_is_group is distinct from new.is_group then
    raise exception 'No se puede mezclar consulta individual y grupal en el mismo horario.';
  end if;

  if not new.is_group then
    raise exception 'Ese horario ya esta ocupado.';
  end if;

  if existing_count >= 10 then
    raise exception 'Esta consulta grupal ya alcanzo el maximo de 10 personas.';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_enforce_capacity on public.appointments;
create trigger appointments_enforce_capacity
  before insert on public.appointments
  for each row execute function public.enforce_appointment_capacity();
