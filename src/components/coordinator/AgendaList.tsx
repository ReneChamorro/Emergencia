import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import {
  APPT_STATUS_LABEL,
  MODALITY_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
  citaAsignadaMsg,
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
  onOpenCase: (caseId: string) => void;
}

interface DayGroup {
  key: string;
  date: Date;
  items: AppointmentFull[];
}

export function AgendaList({ appointments, loading, from, to, onOpenCase }: Props) {
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
                  <li key={a.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenCase(a.case_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenCase(a.case_id);
                        }
                      }}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-accent/40 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{a.professional?.full_name ?? "(sin profesional)"}</span>
                          <span aria-hidden="true">·</span>
                          <span>{MODALITY_LABEL[a.modality]}</span>
                          <span aria-hidden="true">·</span>
                          <span>Contacto {a.contact_number}/3</span>
                          {a.case?.whatsapp && (
                            <WhatsAppLink
                              phone={a.case.whatsapp}
                              message={citaAsignadaMsg(a.scheduled_at)}
                              iconClassName="size-3"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={
                            "rounded-full border px-2 py-0.5 text-xs font-medium " +
                            (a.status === "programada"
                              ? "border-accent/30 bg-accent/10 text-accent"
                              : a.status === "realizada"
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-border bg-muted text-muted-foreground")
                          }
                        >
                          {APPT_STATUS_LABEL[a.status]}
                        </span>
                        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                    </div>
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
