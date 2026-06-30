-- =============================================================
-- Backfill: corrige casos que tienen una cita creada pero quedaron
-- sin assigned_professional_id por el bug del QuickScheduleDialog
-- (ya corregido en el codigo). Seguro de re-ejecutar.
-- =============================================================

update public.cases c
set
  assigned_professional_id = a.professional_id,
  status = case when c.status = 'nuevo' then 'asignado' else c.status end
from (
  select distinct on (case_id) case_id, professional_id
  from public.appointments
  order by case_id, created_at asc
) a
where c.id = a.case_id
  and c.assigned_professional_id is null;

-- Diagnostico: casos cuyos datos violarian las restricciones de la
-- migracion 0002 (lo que bloquearia CUALQUIER update futuro a esa fila,
-- aunque no se toquen esas columnas). Si esta consulta devuelve filas,
-- compartelas para corregirlas.
select id, patient_name, whatsapp, city, email, status
from public.cases
where char_length(patient_name) not between 2 and 120
   or (patient_age is not null and patient_age not between 0 and 120)
   or whatsapp !~ '^\+?[0-9]{7,15}$'
   or (city is not null and char_length(city) > 80)
   or (email is not null and char_length(email) > 150)
   or (availability is not null and char_length(availability) > 300)
   or (observations is not null and char_length(observations) > 1000)
   or (notes is not null and char_length(notes) > 5000);
