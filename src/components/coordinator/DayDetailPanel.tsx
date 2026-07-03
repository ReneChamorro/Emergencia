import { CalendarPlus, ChevronRight, Phone, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  groupByProfessional,
  toDateKey,
  buildHourSlots,
  timeInRange,
  type AppointmentFull,
  type HourSlot,
} from "@/lib/calendarUtils";
import type { AvailabilityBlock, Profile } from "@/types/database";

interface Props {
  day: Date;
  appointments: AppointmentFull[];
  availability: AvailabilityBlock[];
  professionals: Profile[];
  onNewAppointment: () => void;
  onSlotClick: (professionalId: string, time: string) => void;
  /** Abre el diálogo completo del caso (mismo menú del panel de casos). */
  onOpenCase: (caseId: string) => void;
}

interface DaySection {
  professionalId: string;
  professionalName: string;
  blocks: AvailabilityBlock[];
  appointments: AppointmentFull[];
}

export function DayDetailPanel({
  day,
  appointments,
  availability,
  professionals,
  onNewAppointment,
  onSlotClick,
  onOpenCase,
}: Props) {
  const key = toDateKey(day);
  const apptGroups = groupByProfessional(appointments);

  // Union de profesionales con citas y/o disponibilidad ese dia
  const sectionMap = new Map<string, DaySection>();
  for (const g of apptGroups) {
    sectionMap.set(g.professionalId, {
      professionalId: g.professionalId,
      professionalName: g.professionalName,
      blocks: [],
      appointments: g.appointments,
    });
  }
  for (const b of availability) {
    const existing = sectionMap.get(b.professional_id);
    if (existing) {
      existing.blocks.push(b);
    } else {
      const prof = professionals.find((p) => p.id === b.professional_id);
      sectionMap.set(b.professional_id, {
        professionalId: b.professional_id,
        professionalName: prof?.full_name ?? "(sin nombre)",
        blocks: [b],
        appointments: [],
      });
    }
  }
  const sections = Array.from(sectionMap.values()).sort((a, b) =>
    a.professionalName.localeCompare(b.professionalName)
  );

  return (
    <div className="flex h-full flex-col" key={key}>
      {/* Header del día */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          <span className="hidden xs:inline">Nueva cita</span>
          <span className="xs:hidden">Nueva</span>
        </Button>
      </div>

      {/* Lista */}
      {sections.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
          <CalendarPlus className="size-8 text-muted-foreground/40" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">Sin citas ni disponibilidad</p>
            <p className="text-xs text-muted-foreground">
              Ningún profesional tiene horario definido para este día.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onNewAppointment}>
            Agendar cita
          </Button>
        </div>
      ) : (
        <div className="space-y-5 overflow-y-auto">
          {sections.map((section) => {
            const slots = buildHourSlots(section.blocks);
            const matchedIds = new Set<string>();
            const slotRows = slots.map((slot) => {
              const appt = section.appointments.find((a) =>
                timeInRange(formatTime(a.scheduled_at), slot.start, slot.end)
              );
              if (appt) matchedIds.add(appt.id);
              return { slot, appointment: appt };
            });
            const leftover = section.appointments.filter((a) => !matchedIds.has(a.id));

            return (
              <div key={section.professionalId}>
                {/* Encabezado de profesional */}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="size-2 rounded-full bg-accent" aria-hidden="true" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.professionalName}
                  </p>
                  {section.appointments.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      · {section.appointments.length} cita{section.appointments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {slots.length > 0 ? (
                  <ul className="space-y-1.5" role="list">
                    {slotRows.map(({ slot, appointment }) =>
                      appointment ? (
                        <AppointmentRow
                          key={appointment.id}
                          a={appointment}
                          onOpenCase={() => onOpenCase(appointment.case_id)}
                        />
                      ) : (
                        <EmptySlotRow
                          key={slot.start}
                          slot={slot}
                          onClick={() => onSlotClick(section.professionalId, slot.start)}
                        />
                      )
                    )}
                  </ul>
                ) : section.appointments.length === 0 ? (
                  <p className="text-xs text-muted-foreground/70">Sin citas en este día.</p>
                ) : null}

                {leftover.length > 0 && (
                  <div className="mt-2">
                    {slots.length > 0 && (
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                        Otras citas (fuera de horario definido)
                      </p>
                    )}
                    <ul className="space-y-1.5" role="list">
                      {leftover.map((a) => (
                        <AppointmentRow key={a.id} a={a} onOpenCase={() => onOpenCase(a.case_id)} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptySlotRow({ slot, onClick }: { slot: HourSlot; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-dashed border-success/40 bg-success/5 px-3 py-2 text-left text-sm transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="w-10 shrink-0 text-xs font-semibold tabular-nums text-success">
          {slot.start}
        </span>
        <span className="flex-1 text-xs font-medium text-success">
          Disponible hasta las {slot.end}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
          <Plus className="size-3" />
          <span className="hidden xs:inline">Agregar paciente</span>
          <span className="xs:hidden">Agregar</span>
        </span>
      </button>
    </li>
  );
}

function AppointmentRow({ a, onOpenCase }: { a: AppointmentFull; onOpenCase: () => void }) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenCase}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenCase();
          }
        }}
        className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-accent/40 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {a.case?.whatsapp && (
              <a
                href={waLink(a.case.whatsapp, citaAsignadaMsg(a.scheduled_at))}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
                title="Abrir WhatsApp con el mensaje de la cita"
              >
                <Phone className="size-3" />
                {a.case.whatsapp}
              </a>
            )}
            <span aria-hidden="true">·</span>
            <span>{MODALITY_LABEL[a.modality]}</span>
            <span aria-hidden="true">·</span>
            <span>Contacto {a.contact_number}/3</span>
          </div>
        </div>

        {/* Estado + chevron (abrir menú del caso) */}
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
  );
}
