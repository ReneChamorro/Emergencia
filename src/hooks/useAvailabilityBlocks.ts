import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AvailabilityBlock } from "@/types/database";

/** Carga los bloques del usuario autenticado (para la vista del profesional). */
export function useMyAvailability() {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("availability_blocks")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    setBlocks((data as AvailabilityBlock[]) ?? []);
    setLoading(false);
  }, []);

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
