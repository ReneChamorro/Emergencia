import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { AvailabilityBlock } from "@/types/database";

/**
 * Carga los bloques del usuario autenticado (para la vista del profesional).
 * Filtra explícitamente por profile.id para que el rol admin no vea bloques ajenos.
 */
export function useMyAvailability() {
  const { profile } = useAuth();
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("availability_blocks")
      .select("*")
      .eq("professional_id", profile.id)
      .order("day_of_week", { ascending: true, nullsFirst: false })
      .order("specific_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true });
    setBlocks((data as AvailabilityBlock[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { void load(); }, [load]);

  return { blocks, loading, reload: load };
}

/** Carga todos los bloques activos (para el coordinador / calendario). */
export function useAllAvailabilityBlocks() {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("availability_blocks")
      .select("*")
      .eq("active", true)
      .order("day_of_week")
      .order("start_time")
      .then(({ data }) => {
        setBlocks((data as AvailabilityBlock[]) ?? []);
        setLoading(false);
      });
  }, []);

  return { blocks, loading };
}
