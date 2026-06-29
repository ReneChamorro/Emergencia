import { CalendarPlus, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  APPT_STATUS_LABEL,
  MODALITY_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
} from "@/lib/domain";
import {
  formatDayHeader,
  formatTime,
  groupByProfessional,
  toDateKey,
  type AppointmentFull,
} from "@/lib/calendarUtils";

interface Props {
  day: Date;
  appointments: AppointmentFull[];
  onNewAppointment: () => void;
}

export function DayDetailPanel({ day, appointments, onNewAppointment }: Props) {
  const groups = groupByProfessional(appointments);
  const key = toDateKey(day);

  return (
    <div className="flex h-full flex-col" key={key}>
      {/* Header del día */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold capitalize text-foreground">
            {formatDayHeader(day)}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {appointments.length === 0
              ? "Sin citas programadas"
              : `${appointments.length} cita${appointments.length !== 1 ? "s" : ""} programada${appointments.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={onNewAppointment} className="shrink-0">
          <CalendarPlus className="size-4" />
          Nueva cita
        </Button>
      </div>

      {/* Lista */}
      {appointments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
          <CalendarPlus className="size-8 text-muted-foreground/40" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">Sin citas este día</p>
            <p className="text-xs text-muted-foreground">
              Agenda una cita para comenzar.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onNewAppointment}>
            Agendar cita
          </Button>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.professionalId}>
              {/* Encabezado de profesional */}
              <div className="mb-2 flex items-center gap-2">
                <div className="size-2 rounded-full bg-accent" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.professionalName}
                </p>
                <span className="text-xs text-muted-foreground">
                  · {group.appointments.length} cita{group.appointments.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Citas del profesional */}
              <ul className="space-y-2" role="list">
                {group.appointments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
                  >
                    {/* Hora */}
                    <span className="mt-0.5 w-10 shrink-0 text-xs font-semibold tabular-nums text-foreground">
                      {formatTime(a.scheduled_at)}
                    </span>

                    {/* Info del paciente */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {a.case?.patient_name ?? "—"}
                        </span>
                        {a.case && (
                          <Badge className={URGENCY_BADGE[a.case.urgency]}>
                            {URGENCY_LABEL[a.case.urgency]}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {a.case?.whatsapp && (
                          <a
                            href={`https://wa.me/${a.case.whatsapp.replace(/[^\d]/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="size-3" />
                            {a.case.whatsapp}
                          </a>
                        )}
                        <span>·</span>
                        <span>{MODALITY_LABEL[a.modality]}</span>
                        <span>·</span>
                        <span>Contacto {a.contact_number}/3</span>
                      </div>
                    </div>

                    {/* Estado */}
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
