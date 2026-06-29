import { useState } from "react";
import { useProfessionals } from "@/hooks/useProfessionals";
import { useCalendarAppointments } from "@/hooks/useCalendarAppointments";
import { toDateKey } from "@/lib/calendarUtils";
import { MonthCalendar } from "./MonthCalendar";
import { DayDetailPanel } from "./DayDetailPanel";
import { QuickScheduleDialog } from "./QuickScheduleDialog";
import { Spinner } from "@/components/ui/spinner";

export function CalendarioTab() {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { professionals } = useProfessionals();
  const { byDate, loading, reload } = useCalendarAppointments(month);

  const dayKey = toDateKey(selectedDay);
  const dayAppointments = byDate.get(dayKey) ?? [];

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
            onNewAppointment={() => setScheduleOpen(true)}
          />
        </div>
      </div>

      <QuickScheduleDialog
        open={scheduleOpen}
        selectedDate={selectedDay}
        professionals={professionals}
        onClose={() => setScheduleOpen(false)}
        onSaved={() => void reload()}
      />
    </>
  );
}
