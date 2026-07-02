import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  groupByDate,
  type AppointmentFull,
} from "@/lib/calendarUtils";

const APPT_SELECT = `
  *,
  case:cases ( id, patient_name, whatsapp, urgency, status, preferred_modality ),
  professional:profiles!appointments_professional_id_fkey ( id, full_name )
`;

export function useCalendarAppointments(month: Date) {
  const [appointments, setAppointments] = useState<AppointmentFull[]>([]);
  const [byDate, setByDate] = useState<Map<string, AppointmentFull[]>>(new Map());
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(APPT_SELECT)
      .gte("scheduled_at", startOfMonth(month).toISOString())
      .lte("scheduled_at", endOfMonth(month).toISOString())
      .order("scheduled_at", { ascending: true });

    if (!error && data) {
      const list = data as unknown as AppointmentFull[];
      setAppointments(list);
      setByDate(groupByDate(list));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.getFullYear(), month.getMonth()]);

  return { appointments, byDate, loading, reload: load };
}

/**
 * Carga las citas dentro de un rango de fechas [from, to] (puede cruzar meses).
 * Solo consulta cuando `enabled` es true y hay ambas fechas.
 */
export function useRangeAppointments(
  from: Date | null,
  to: Date | null,
  enabled: boolean
) {
  const [appointments, setAppointments] = useState<AppointmentFull[]>([]);
  const [loading, setLoading] = useState(false);

  const fromKey = from ? startOfDay(from).getTime() : 0;
  const toKey = to ? endOfDay(to).getTime() : 0;

  useEffect(() => {
    if (!enabled || !from || !to) {
      setAppointments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("appointments")
      .select(APPT_SELECT)
      .gte("scheduled_at", startOfDay(from).toISOString())
      .lte("scheduled_at", endOfDay(to).toISOString())
      .order("scheduled_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setAppointments(data as unknown as AppointmentFull[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fromKey, toKey]);

  return { appointments, loading };
}
