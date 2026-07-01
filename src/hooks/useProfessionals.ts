import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

/** Carga los profesionales activos (para asignar casos y mostrar nombres). */
export function useProfessionals() {
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        const list = (data as Profile[]) ?? [];
        setProfessionals(list.filter((p) => p.role === "professional" || p.role === "admin"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { professionals, loading };
}
