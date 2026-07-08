-- =============================================================
-- 0013: Grupos de edad que trata cada profesional.
--
-- El coordinador reclutó profesionales por WhatsApp, donde cada uno indicó
-- si atiende ninos/adolescentes, adultos y/o adultos mayores. Se necesita
-- ese dato en la app para poder asignar casos al profesional correcto.
--
-- Un profesional puede tratar mas de un grupo a la vez, por eso es un
-- arreglo del enum, no una columna de valor unico.
--
-- No hace falta tocar RLS: la politica "profiles: actualizar el propio"
-- (0001_init.sql) ya permite que cada profesional actualice cualquier
-- columna de su propia fila (el trigger de 0002_security.sql solo bloquea
-- cambios a role/active), asi que el autoservicio no necesita politica nueva.
-- =============================================================

create type age_group as enum ('ninos_adolescentes', 'adultos', 'adultos_mayores');

alter table public.profiles
  add column age_groups age_group[] not null default '{}';
