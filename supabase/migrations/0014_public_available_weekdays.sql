-- =============================================================
-- 0014: Dias de la semana con disponibilidad, expuestos al publico.
--
-- El formulario de intake (anon, sin sesion) necesita saber que dias de
-- la semana tienen al menos un profesional con disponibilidad recurrente
-- activa, para no ofrecer dias donde nadie atiende. availability_blocks
-- no tiene politica RLS para anon (por diseno, no debe exponer horarios
-- ni identidad de profesionales), asi que se expone solo el agregado
-- minimo necesario (los numeros de dia, 0=lunes...6=domingo) via una
-- funcion SECURITY DEFINER, igual que case_exists en 0010.
-- =============================================================

create or replace function public.available_weekdays()
returns int[]
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(array_agg(distinct day_of_week), '{}')
  from public.availability_blocks
  where active = true and day_of_week is not null;
$$;

grant execute on function public.available_weekdays() to anon, authenticated;
