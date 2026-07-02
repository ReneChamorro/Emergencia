import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  APPT_STATUS_LABEL,
  MODALITY_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
  citaAsignadaMsg,
  waLink,
} from "@/lib/domain";
import {
  formatDayHeader,
  formatTime,
  toDateKey,
  type AppointmentFull,
} from "@/lib/calendarUtils";

interface Props {
  appointments: AppointmentFull[];
  loading: boolean;
  from: Date;
  to: Date;
}

interface DayGroup {
  key: string;
  date: Date;
  items: AppointmentFull[];
}

export function AgendaList({ appointments, loading, from, to }: Props) {
  // Agrupar cronologicamente por dia (las citas ya vienen ordenadas por scheduled_at).
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();
  for (const a of appointments) {
    const d = new Date(a.scheduled_at);
    const key = toDateKey(d);
    let g = index.get(key);
    if (!g) {
      g = { key, date: d, items: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.items.push(a);
  }

  const rangeLabel = `${from.toLocaleDateString("es-VE", { day: "numeric", month: "short" })} – ${to.toLocaleDateString("es-VE", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Agenda del rango</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {rangeLabel} · {appointments.length} cita{appointments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Cargando agenda...
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm font-medium text-foreground">Sin citas en el rango</p>
          <p className="text-xs text-muted-foreground">
            No hay citas que coincidan con los filtros en estas fechas.
          </p>
        </div>
      ) : (
        <div className="space-y-5 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-xs font-semibold uppercase capitalize tracking-wide text-muted-foreground">
                {formatDayHeader(g.date)}
              </p>
              <ul className="space-y-1.5" role="list">
                {g.items.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
                  >
                    <span className="mt-0.5 w-10 shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {formatTime(a.scheduled_at)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-foreground">
                          {a.case?.patient_name ?? "—"}
                        </span>
                        {a.case && (
                          <Badge className={URGENCY_BADGE[a.case.urgency]}>
                            {URGENCY_LABEL[a.case.urgency]}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{a.professional?.full_name ?? "(sin profesional)"}</span>
                        <span>·</span>
                        <span>{MODALITY_LABEL[a.modality]}</span>
                        <span>·</span>
                        <span>Contacto {a.contact_number}/3</span>
                        {a.case?.whatsapp && (
                          <a
                            href={waLink(a.case.whatsapp, citaAsignadaMsg(a.scheduled_at))}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                            title="Abrir WhatsApp con el mensaje de la cita"
                          >
                            <Phone className="size-3" />
                            {a.case.whatsapp}
                          </a>
                        )}
                      </div>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium " +
                        (a.status === "programada"
                          ? "border-accent/30 bg-accent/10 text-accent"
                          : a.status === "realizada"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border bg-muted text-muted-foreground")
                      }
                    >
                      {APPT_STATUS_LABEL[a.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
