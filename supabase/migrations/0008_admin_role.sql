-- =============================================================
-- 0008: Rol "admin" — fusión de coordinador y profesional.
--
-- La estrategia más limpia es extender is_coordinator() para que
-- también devuelva true cuando el rol es 'admin'. Así TODAS las
-- políticas RLS del coordinador cubren al admin automáticamente,
-- sin tocar ninguna política individualmente.
-- =============================================================

-- 1. Añadir el valor al enum (idempotente gracias al IF NOT EXISTS de PG 14+)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Actualizar is_coordinator() para incluir admin
CREATE OR REPLACE FUNCTION public.is_coordinator()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role IN ('coordinator', 'admin')
  FROM public.profiles
  WHERE id = auth.uid()
$$;
