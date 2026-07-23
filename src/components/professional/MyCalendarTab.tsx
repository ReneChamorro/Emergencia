import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMyAvailability } from "@/hooks/useAvailabilityBlocks";
import { useCalendarAppointments } from "@/hooks/useCalendarAppointments";
import { MonthCalendar } from "@/components/coordinator/MonthCalendar";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { APPT_STATUS_LABEL, MODALITY_LABEL, citaAsignadaMsg } from "@/lib/domain";
import {
  GROUP_CAPACITY,
  appointmentsInSlot,
  buildHourSlots,
  formatDayHeader,
  formatTime,
  getBlocksForDate,
  groupByDate,
  occupiedGroupSpots,
  toDateKey,
  type AppointmentFull,
  type HourSlot,
} from "@/lib/calendarUtils";
import { Users } from "lucide-react";

/** Calendario de solo lectura para un profesional: sus propias citas y disponibilidad. */
export function MyCalendarTab() {
  const { profile } = useAuth();
  const { blocks: myBlocks } = useMyAvailability();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  // useCalendarAppointments es el hook "de coordinador": si el rol es
  // coordinator/admin viendo esta pestaña, RLS le dejaria ver las citas de
  // TODOS los profesionales. Filtramos explicitamente a este profesional
  // (mismo patron que ScheduleFollowUpDialog y CaseDetailDialog).
  const { appointments: monthAppointments, loading } = useCalendarAppointments(month);
  const myAppointments = useMemo(
    () => monthAppointments.filter((a) => a.professional_id === profile?.id),
    [monthAppointments, profile?.id]
  );
  const byDate = useMemo(() => groupByDate(myAppointments), [myAppointments]);

  const activeBlocks = useMemo(() => myBlocks.filter((b) => b.active), [myBlocks]);
  const availabilityDows = useMemo(
    () =>
      new Set(
        activeBlocks
          .filter((b) => b.specific_date === null && b.day_of_week !== null)
          .map((b) => b.day_of_week as number)
      ),
    [activeBlocks]
  );
  const availabilitySpecificDates = useMemo(
    () => new Set(activeBlocks.filter((b) => b.specific_date !== null).map((b) => b.specific_date as string)),
    [activeBlocks]
  );

  const dayKey = toDateKey(selectedDay);
  const dayAppointments = byDate.get(dayKey) ?? [];

  const slotRows = useMemo(() => {
    const dayBlocks = getBlocksForDate(myBlocks, selectedDay);
    const slots = buildHourSlots(dayBlocks);
    const matchedIds = new Set<string>();
    const rows = slots.map((slot) => {
      const matched = appointmentsInSlot(dayAppointments, slot);
      matched.forEach((a) => matchedIds.add(a.id));
      return { slot, appointments: matched };
    });
    const leftover = dayAppointments.filter((a) => !matchedIds.has(a.id));
    return { rows, leftover };
  }, [myBlocks, selectedDay, dayAppointments]);

  return (
    <div className="grid gap-4 sm:grid-cols-[280px_1fr]">
      <div className="rounded-lg border border-border p-3">
        <MonthCalendar
          month={month}
          selectedDay={selectedDay}
          byDate={byDate}
          availabilityDows={availabilityDows}
          availabilitySpecificDates={availabilitySpecificDates}
          onDaySelect={setSelectedDay}
          onMonthChange={(m) => {
            setMonth(m);
            setSelectedDay(new Date(m.getFullYear(), m.getMonth(), 1));
          }}
        />
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-sm font-semibold capitalize text-foreground">
          {formatDayHeader(selectedDay)}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Cargando...
          </div>
        ) : slotRows.rows.length === 0 && slotRows.leftover.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            No tienes disponibilidad ni citas para este día.
          </p>
        ) : (
          <ul className="space-y-1.5" role="list">
            {slotRows.rows.map(({ slot, appointments }) => (
              <ReadOnlySlotRow key={slot.start} slot={slot} appointments={appointments} />
            ))}
            {slotRows.leftover.map((a) => (
              <ReadOnlyAppointmentRow key={a.id} appointment={a} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReadOnlySlotRow({ slot, appointments }: { slot: HourSlot; appointments: AppointmentFull[] }) {
  if (slot.is_group) {
    const occupied = occupiedGroupSpots(appointments);
    return (
      <li className="space-y-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-foreground">{slot.start}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Users className="size-3" /> Grupal
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            {occupied}/{GROUP_CAPACITY}
          </span>
        </div>
        {appointments.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 pl-[3.75rem]">
            {appointments.map((a) => (
              <li key={a.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs">
                <span className={a.status !== "programada" ? "text-muted-foreground line-through" : "text-foreground"}>
                  {a.case?.patient_name ?? "—"}
                </span>
                {a.status !== "programada" && (
                  <Badge className="border-border bg-secondary px-1 py-0 text-[10px] text-secondary-foreground">
                    {APPT_STATUS_LABEL[a.status]}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  const appt = appointments[0];
  if (appt) return <ReadOnlyAppointmentRow appointment={appt} />;

  return (
    <li className="flex min-h-11 items-center gap-3 rounded-lg border border-dashed border-success/40 bg-success/5 px-3 py-2 text-sm">
      <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-success">{slot.start}</span>
      <span className="flex-1 text-xs font-medium text-success">Disponible hasta las {slot.end}</span>
    </li>
  );
}

function ReadOnlyAppointmentRow({ appointment: a }: { appointment: AppointmentFull }) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-foreground">{formatTime(a.scheduled_at)}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{a.case?.patient_name ?? "—"}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {MODALITY_LABEL[a.modality]} · contacto {a.contact_number}
      </span>
      {a.case?.whatsapp && (
        <WhatsAppLink
          phone={a.case.whatsapp}
          message={citaAsignadaMsg(a.scheduled_at)}
          iconOnly
          iconClassName="size-3.5"
        />
      )}
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
          a.status === "programada"
            ? "border-accent/30 bg-accent/10 text-accent"
            : a.status === "realizada"
              ? "border-success/30 bg-success/10 text-success"
              : "border-border bg-muted text-muted-foreground"
        )}
      >
        {APPT_STATUS_LABEL[a.status]}
      </span>
    </li>
  );
}
