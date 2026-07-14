-- =============================================================
-- Backfill: marca assignment_notified_at para casos cuyo correo de
-- "caso asignado" ya se envio antes de que existiera esta columna
-- (reconstruido a partir del log de envios de Resend). Fechas son
-- aproximadas (Resend solo muestra "hace X dias"). Seguro de re-ejecutar:
-- solo toca filas que aun tienen assignment_notified_at NULL.
--
-- Se excluyen a proposito los envios que Resend marco como
-- Bounced/Suppressed (nunca llegaron al profesional): Miguel Bellorin,
-- Aylin Farias, Freysela Garcia. Esos probablemente necesiten reenvio.
-- =============================================================

update public.cases c
set assignment_notified_at = v.sent_at
from (values
  ('Nahomi Hernández',            timestamptz '2026-07-13 12:00:00'),
  ('Luz Lopez',                   timestamptz '2026-07-12 12:00:00'),
  ('Gaston Coronado',             timestamptz '2026-07-12 12:00:00'),
  ('Ámbar Ambrocio',              timestamptz '2026-07-12 12:00:00'),
  ('Ciria Andrade',               timestamptz '2026-07-12 12:00:00'),
  ('Rafael Rodríguez',            timestamptz '2026-07-12 12:00:00'),
  ('Jeannette Erazo',             timestamptz '2026-07-10 12:00:00'),
  ('Lisbeth Gómez de De Abreu',   timestamptz '2026-07-10 12:00:00'),
  ('Sile Fernández',              timestamptz '2026-07-10 12:00:00'),
  ('Sofia Alejandra',             timestamptz '2026-07-10 12:00:00'),
  ('Mónica Linares',              timestamptz '2026-07-10 12:00:00'),
  ('Jhongrid Gerder',             timestamptz '2026-07-09 12:00:00'),
  ('Adela Piñeros',               timestamptz '2026-07-09 12:00:00'),
  ('Sofia Sánchez',               timestamptz '2026-07-08 12:00:00'),
  ('Yuleidi Vásquez',             timestamptz '2026-07-08 12:00:00'),
  ('Yohangelly De La Rosa',       timestamptz '2026-07-07 12:00:00'),
  ('Juan Carrillo Ramírez',       timestamptz '2026-07-07 12:00:00'),
  ('José Blequett',               timestamptz '2026-07-06 12:00:00'),
  ('María Peralta',               timestamptz '2026-07-06 12:00:00'),
  ('Rosali Gómez',                timestamptz '2026-07-06 12:00:00'),
  ('Marcos Tovar',                timestamptz '2026-07-06 12:00:00'),
  ('Jonay Rondón',                timestamptz '2026-07-06 12:00:00'),
  ('Gerardina Adesso',            timestamptz '2026-07-05 12:00:00'),
  ('María Pérez',                 timestamptz '2026-07-04 12:00:00'),
  ('Thais Pérez',                 timestamptz '2026-07-04 12:00:00'),
  ('Carmen Jimenez',              timestamptz '2026-07-04 12:00:00'),
  ('Oriana Rodríguez',            timestamptz '2026-07-04 12:00:00')
) as v(patient_name, sent_at)
where c.patient_name = v.patient_name
  and c.assignment_notified_at is null;

-- Diagnostico: nombres de la lista de arriba que NO encontraron un caso
-- coincidente (typo, acento distinto, o el caso no existe con ese nombre
-- exacto). Si aparecen filas aqui, corrige el nombre y reejecuta.
select v.patient_name as nombre_sin_match
from (values
  ('Nahomi Hernández'), ('Luz Lopez'), ('Gaston Coronado'), ('Ámbar Ambrocio'),
  ('Ciria Andrade'), ('Rafael Rodríguez'), ('Jeannette Erazo'),
  ('Lisbeth Gómez de De Abreu'), ('Sile Fernández'), ('Sofia Alejandra'),
  ('Mónica Linares'), ('Jhongrid Gerder'), ('Adela Piñeros'), ('Sofia Sánchez'),
  ('Yuleidi Vásquez'), ('Yohangelly De La Rosa'), ('Juan Carrillo Ramírez'),
  ('José Blequett'), ('María Peralta'), ('Rosali Gómez'), ('Marcos Tovar'),
  ('Jonay Rondón'), ('Gerardina Adesso'), ('María Pérez'), ('Thais Pérez'),
  ('Carmen Jimenez'), ('Oriana Rodríguez')
) as v(patient_name)
where not exists (
  select 1 from public.cases c where c.patient_name = v.patient_name
);
