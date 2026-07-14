import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/domain";
import { Spinner } from "@/components/ui/spinner";
import {
  CalendarPlus,
  CalendarX,
  Mail,
  History,
  RefreshCcw,
  UserMinus,
} from "lucide-react";

interface EventRow {
  id: string;
  event_type: string;
  detail: string | null;
  created_at: string;
  created_by_profile: { full_name: string } | null;
}

const EVENT_ICON: Record<string, typeof History> = {
  actualizacion: RefreshCcw,
  profesional: RefreshCcw,
  correo_enviado: Mail,
  cita_creada: CalendarPlus,
  cita_actualizada: RefreshCcw,
  cita_eliminada: CalendarX,
  desasignado: UserMinus,
};

/** Historial de acciones del caso (asignaciones, citas, correos, cambios de estado). */
export function CaseEventsTimeline({ caseId, refreshKey }: { caseId: string; refreshKey?: number }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("case_events")
      .select("id, event_type, detail, created_at, created_by_profile:profiles!case_events_created_by_fkey ( full_name )")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setEvents((data as unknown as EventRow[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Spinner className="size-4" /> Cargando historial...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aun no hay actividad registrada en este caso.</p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {events.map((e) => {
        const Icon = EVENT_ICON[e.event_type] ?? History;
        return (
          <li key={e.id} className="flex items-start gap-2.5 text-sm">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-foreground">{e.detail ?? e.event_type}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.created_at)}
                {e.created_by_profile?.full_name ? ` · ${e.created_by_profile.full_name}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
