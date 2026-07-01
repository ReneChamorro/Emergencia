import { useMemo, useState } from "react";
import { useProfessionals } from "@/hooks/useProfessionals";
import { useCalendarAppointments } from "@/hooks/useCalendarAppointments";
import { useAllAvailabilityBlocks } from "@/hooks/useAvailabilityBlocks";
import { toDateKey, dateToDayOfWeek } from "@/lib/calendarUtils";
import { MonthCalendar } from "./MonthCalendar";
import { DayDetailPanel } from "./DayDetailPanel";
import { QuickScheduleDialog } from "./QuickScheduleDialog";
import { Spinner } from "@/components/ui/spinner";

export function CalendarioTab() {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [slotPreset, setSlotPreset] = useState<{ professionalId: string; time: string } | null>(null);

  const { professionals } = useProfessionals();
  const { byDate, loading, reload } = useCalendarAppointments(month);
  const { blocks: availabilityBlocks } = useAllAvailabilityBlocks();

  const dayKey = toDateKey(selectedDay);
  const dayAppointments = byDate.get(dayKey) ?? [];

  const dayOfWeek = dateToDayOfWeek(selectedDay);

  // Bloques del dia seleccionado: recurrentes (por dia semana) + puntuales (por fecha exacta)
  const dayAvailability = useMemo(
    () =>
      availabilityBlocks.filter(
        (b) =>
          (b.specific_date === null && b.day_of_week === dayOfWeek) ||
          b.specific_date === dayKey
      ),
    [availabilityBlocks, dayOfWeek, dayKey]
  );

  // Dias de la semana con disponibilidad recurrente → punto azul en el mes
  const availabilityDows = useMemo(
    () =>
      new Set(
        availabilityBlocks
          .filter((b) => b.specific_date === null && b.day_of_week !== null)
          .map((b) => b.day_of_week as number)
      ),
    [availabilityBlocks]
  );

  // Fechas concretas con disponibilidad puntual → punto azul en la celda exacta
  const availabilitySpecificDates = useMemo(
    () =>
      new Set(
        availabilityBlocks
          .filter((b) => b.specific_date !== null)
          .map((b) => b.specific_date as string)
      ),
    [availabilityBlocks]
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Panel izquierdo: calendario */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          {loading && (
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3" />
              Cargando...
            </div>
          )}
          <MonthCalendar
            month={month}
            selectedDay={selectedDay}
            byDate={byDate}
            availabilityDows={availabilityDows}
            availabilitySpecificDates={availabilitySpecificDates}
            onDaySelect={setSelectedDay}
            onMonthChange={(m) => {
              setMonth(m);
              // Seleccionar el primer dia del nuevo mes al navegar
              setSelectedDay(new Date(m.getFullYear(), m.getMonth(), 1));
            }}
          />
        </div>

        {/* Panel derecho: detalle del día */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <DayDetailPanel
            day={selectedDay}
            appointments={dayAppointments}
            availability={dayAvailability}
            professionals={professionals}
            onNewAppointment={() => {
              setSlotPreset(null);
              setScheduleOpen(true);
            }}
            onSlotClick={(professionalId, time) => {
              setSlotPreset({ professionalId, time });
              setScheduleOpen(true);
            }}
          />
        </div>
      </div>

      <QuickScheduleDialog
        open={scheduleOpen}
        selectedDate={selectedDay}
        professionals={professionals}
        availability={dayAvailability}
        presetProfessionalId={slotPreset?.professionalId}
        presetTime={slotPreset?.time}
        onClose={() => setScheduleOpen(false)}
        onSaved={() => void reload()}
      />
    </>
  );
}
