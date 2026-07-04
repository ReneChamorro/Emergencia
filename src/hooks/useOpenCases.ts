import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Case } from "@/types/database";
import { URGENCY_ORDER } from "@/lib/domain";

/** Casos nuevos (sin profesional asignado) listos para colocar en un horario. */
export function useOpenCases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cases")
      .select("*")
      .eq("status", "nuevo")
      .order("created_at", { ascending: false });
    const list = ((data as Case[]) ?? []).sort(
      (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    );
    setCases(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { cases, loading, reload: load };
}
