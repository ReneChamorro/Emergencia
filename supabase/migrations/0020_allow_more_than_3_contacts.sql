-- =============================================================
-- El limite de 3 contactos era un tope duro (constraint 1..3). Ahora
-- 3 sigue siendo lo recomendado (asi lo comunica el frontend), pero un
-- profesional puede agendar mas sesiones si el caso realmente lo
-- necesita. Se quita el tope superior de la base de datos; solo se
-- exige que sea positivo.
-- =============================================================

alter table public.appointments
  drop constraint if exists appointments_contact_number_check;

alter table public.appointments
  add constraint appointments_contact_number_check
  check (contact_number > 0);
