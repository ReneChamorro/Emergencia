import { CalendarPlus, ChevronRight, MousePointerClick, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { AgeGroupBadges } from "@/components/ui/age-group-badges";
import { GroupSlotRow } from "./DayScheduleSlots";
import {
  APPT_STATUS_LABEL,
  MODALITY_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
  citaAsignadaMsg,
} from "@/lib/domain";
import {
  appointmentsInSlot,
  formatDayHeader,
  formatTime,
  franjaOfTime,
  groupByProfessional,
  toDateKey,
  buildHourSlots,
  type AppointmentFull,
  type HourSlot,
  type TimeOfDay,
} from "@/lib/calendarUtils";
import { cn } from "@/lib/utils";
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
  /** Nombre del caso seleccionado en "Casos abiertos" (si hay uno armado para asignar). */
  pendingCaseName?: string | null;
  /** Franja horaria activa en los filtros (controla qué horarios/citas se muestran). */
  franja?: TimeOfDay | "todas";
  /** Filtro de fila (franja + estado + urgencia) para citas ya agendadas. */
  rowFilter?: (a: AppointmentFull) => boolean;
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
  pendingCaseName,
  franja = "todas",
  rowFilter = () => true,
}: Props) {
  const key = toDateKey(day);
  const visibleAppointments = appointments.filter(rowFilter);
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

  const profMap = new Map(professionals.map((p) => [p.id, p]));

  const sectionElements = sections
    .map((section) => {
      const slots = buildHourSlots(section.blocks);
      const matchedIds = new Set<string>();
      const slotRows = slots.map((slot) => {
        const matched = appointmentsInSlot(section.appointments, slot);
        matched.forEach((a) => matchedIds.add(a.id));
        return { slot, appointments: matched };
      });
      const leftover = section.appointments.filter((a) => !matchedIds.has(a.id));

      // Filas realmente visibles con los filtros activos. Una cita ocupada
      // que no pasa el filtro se oculta por completo (nunca cae a "libre").
      // Los slots grupales solo se ocultan por franja: mezclan varios
      // pacientes, así que el filtro de estado/urgencia no aplica a nivel
      // de grupo (la capacidad mostrada debe ser siempre la real).
      const visibleSlotRows = slotRows.filter(({ slot, appointments: slotAppts }) => {
        if (slot.is_group) return franja === "todas" || franjaOfTime(slot.start) === franja;
        const appt = slotAppts[0];
        return appt ? rowFilter(appt) : franja === "todas" || franjaOfTime(slot.start) === franja;
      });
      const visibleLeftover = leftover.filter(rowFilter);
      const visibleCount = section.appointments.filter(rowFilter).length;
      const noScheduleAtAll = slots.length === 0 && section.appointments.length === 0;

      // Nada que mostrar en esta sección con los filtros actuales: se oculta entera.
      if (visibleSlotRows.length === 0 && visibleLeftover.length === 0 && !noScheduleAtAll) {
        return null;
      }

      return (
        <div key={section.professionalId}>
          {/* Encabezado de profesional */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="size-2 rounded-full bg-accent" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.professionalName}
            </p>
            <AgeGroupBadges groups={profMap.get(section.professionalId)?.age_groups} short />
            {visibleCount > 0 && (
              <span className="text-xs text-muted-foreground">
                · {visibleCount} cita{visibleCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {visibleSlotRows.length > 0 ? (
            <ul className="space-y-1.5" role="list">
              {visibleSlotRows.map(({ slot, appointments: slotAppts }) =>
                slot.is_group ? (
                  <GroupSlotRow
                    key={slot.start}
                    slot={slot}
                    appointments={slotAppts}
                    selected={!!pendingCaseName}
                    addLabel={pendingCaseName ? "Asignar aquí" : undefined}
                    onAdd={() => onSlotClick(section.professionalId, slot.start)}
                  />
                ) : slotAppts[0] ? (
                  <AppointmentRow
                    key={slotAppts[0].id}
                    a={slotAppts[0]}
                    onOpenCase={() => onOpenCase(slotAppts[0].case_id)}
                  />
                ) : (
                  <EmptySlotRow
                    key={slot.start}
                    slot={slot}
                    pending={!!pendingCaseName}
                    onClick={() => onSlotClick(section.professionalId, slot.start)}
                  />
                )
              )}
            </ul>
          ) : noScheduleAtAll ? (
            <p className="text-xs text-muted-foreground/70">Sin citas en este día.</p>
          ) : null}

          {visibleLeftover.length > 0 && (
            <div className="mt-2">
              {visibleSlotRows.length > 0 && (
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  Otras citas (fuera de horario definido)
                </p>
              )}
              <ul className="space-y-1.5" role="list">
                {visibleLeftover.map((a) => (
                  <AppointmentRow key={a.id} a={a} onOpenCase={() => onOpenCase(a.case_id)} />
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    })
    .filter((el): el is React.ReactElement => el !== null);

  return (
    <div className="flex h-full flex-col" key={key}>
      {/* Header del día */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold capitalize text-foreground">
            {formatDayHeader(day)}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {visibleAppointments.length === 0
              ? "Sin citas programadas"
              : `${visibleAppointments.length} cita${visibleAppointments.length !== 1 ? "s" : ""} programada${visibleAppointments.length !== 1 ? "s" : ""}`}
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
      ) : sectionElements.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center">
          <p className="text-sm font-medium text-foreground">Sin resultados con estos filtros</p>
          <p className="text-xs text-muted-foreground">
            Prueba a limpiar algún filtro para ver más horarios o citas.
          </p>
        </div>
      ) : (
        <div className="space-y-5 overflow-y-auto">{sectionElements}</div>
      )}
    </div>
  );
}

function EmptySlotRow({
  slot,
  pending,
  onClick,
}: {
  slot: HourSlot;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          pending
            ? "border-accent/60 bg-accent/10 hover:bg-accent/15"
            : "border-success/40 bg-success/5 hover:bg-success/10"
        )}
      >
        <span
          className={cn(
            "w-10 shrink-0 text-xs font-semibold tabular-nums",
            pending ? "text-accent" : "text-success"
          )}
        >
          {slot.start}
        </span>
        <span className={cn("flex-1 text-xs font-medium", pending ? "text-accent" : "text-success")}>
          Disponible hasta las {slot.end}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            pending ? "bg-accent/20 text-accent" : "bg-success/15 text-success"
          )}
        >
          {pending ? <MousePointerClick className="size-3" /> : <Plus className="size-3" />}
          {pending ? "Asignar aquí" : (
            <>
              <span className="hidden xs:inline">Agregar paciente</span>
              <span className="xs:hidden">Agregar</span>
            </>
          )}
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
              <WhatsAppLink
                phone={a.case.whatsapp}
                message={citaAsignadaMsg(a.scheduled_at)}
                iconClassName="size-3"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <span aria-hidden="true">·</span>
            <span>{MODALITY_LABEL[a.modality]}</span>
            <span aria-hidden="true">·</span>
            <span>Contacto {a.contact_number}</span>
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
