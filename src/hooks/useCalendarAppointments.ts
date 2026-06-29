import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth, groupByDate, type AppointmentFull } from "@/lib/calendarUtils";

export function useCalendarAppointments(month: Date) {
  const [appointments, setAppointments] = useState<AppointmentFull[]>([]);
  const [byDate, setByDate] = useState<Map<string, AppointmentFull[]>>(new Map());
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        case:cases ( id, patient_name, whatsapp, urgency, status, preferred_modality ),
        professional:profiles!appointments_professional_id_fkey ( id, full_name )
      `)
      .gte("scheduled_at", startOfMonth(month).toISOString())
      .lte("scheduled_at", endOfMonth(month).toISOString())
      .order("scheduled_at", { ascending: true });

    if (!error && data) {
      const list = data as AppointmentFull[];
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
