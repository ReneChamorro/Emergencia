-- =============================================================
-- 0007: Bloques de disponibilidad por fecha especifica (one-off)
--
-- Un bloque ahora es SEMANAL (day_of_week set, specific_date null)
-- o PUNTUAL (specific_date set, day_of_week null).
-- Los bloques puntuales aparecen solo en esa fecha concreta.
-- =============================================================

-- 1. Hacer day_of_week nullable para los bloques puntuales
ALTER TABLE public.availability_blocks
  ALTER COLUMN day_of_week DROP NOT NULL;

-- 2. Nueva columna: fecha especifica (solo para bloques puntuales)
ALTER TABLE public.availability_blocks
  ADD COLUMN IF NOT EXISTS specific_date DATE NULL;

-- 3. Eliminar constraint inline de day_of_week (Postgres la nombra automaticamente)
ALTER TABLE public.availability_blocks
  DROP CONSTRAINT IF EXISTS availability_blocks_day_of_week_check;

-- 4. Un bloque es SEMANAL o PUNTUAL, nunca los dos ni ninguno.
ALTER TABLE public.availability_blocks
  ADD CONSTRAINT availability_blocks_type_check CHECK (
    (day_of_week IS NOT NULL AND specific_date IS NULL)
    OR
    (day_of_week IS NULL AND specific_date IS NOT NULL)
  );

-- 5. Rango valido de day_of_week cuando se usa (0=lunes, 6=domingo)
ALTER TABLE public.availability_blocks
  ADD CONSTRAINT availability_blocks_dow_range CHECK (
    day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)
  );
