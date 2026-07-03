import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfessionals } from "@/hooks/useProfessionals";
import { useCalendarAppointments, useRangeAppointments } from "@/hooks/useCalendarAppointments";
import { useAllAvailabilityBlocks } from "@/hooks/useAvailabilityBlocks";
import type { Case } from "@/types/database";
import {
  toDateKey,
  dateToDayOfWeek,
  timeOfDay,
  parseDateInput,
  groupByDate,
  type AppointmentFull,
} from "@/lib/calendarUtils";
import { MonthCalendar } from "./MonthCalendar";
import { DayDetailPanel } from "./DayDetailPanel";
import { QuickScheduleDialog } from "./QuickScheduleDialog";
import { AgendaList } from "./AgendaList";
import { CaseDetailDialog } from "./CaseDetailDialog";
import {
  CalendarFilters,
  EMPTY_FILTERS,
  isRangeActive,
  type CalendarFilterState,
} from "./CalendarFilters";
import { Spinner } from "@/components/ui/spinner";

/** Predicado de filtros aplicado a una cita (médico + franja + estado + urgencia). */
function matchesFilters(a: AppointmentFull, f: CalendarFilterState): boolean {
  if (f.professionalId !== "todos" && a.professional_id !== f.professionalId) return false;
  if (f.franja !== "todas" && timeOfDay(a.scheduled_at) !== f.franja) return false;
  if (f.apptStatus !== "todas" && a.status !== f.apptStatus) return false;
  if (f.urgency !== "todas" && (a.case?.urgency ?? null) !== f.urgency) return false;
  return true;
}

export function CalendarioTab() {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [slotPreset, setSlotPreset] = useState<{ professionalId: string; time: string } | null>(null);
  const [filters, setFilters] = useState<CalendarFilterState>(EMPTY_FILTERS);
  const [detailCase, setDetailCase] = useState<Case | null>(null);

  const { professionals } = useProfessionals();
  const { appointments, loading, reload } = useCalendarAppointments(month);
  const { blocks: availabilityBlocks } = useAllAvailabilityBlocks();

  // Abre el mismo diálogo del panel de casos al clickear una cita en el calendario.
  async function openCase(caseId: string) {
    const { data } = await supabase.from("cases").select("*").eq("id", caseId).single();
    if (data) setDetailCase(data as Case);
  }

  const rangeActive = isRangeActive(filters);
  const rangeFrom = filters.from ? parseDateInput(filters.from) : null;
  const rangeTo = filters.to ? parseDateInput(filters.to) : null;
  const { appointments: rangeAppts, loading: rangeLoading } = useRangeAppointments(
    rangeFrom,
    rangeTo,
    rangeActive
  );

  // Citas del mes que pasan los filtros → dots del calendario
  const filteredByDate = useMemo(() => {
    const list = appointments.filter((a) => matchesFilters(a, filters));
    return groupByDate(list);
  }, [appointments, filters]);

  const dayKey = toDateKey(selectedDay);
  const dayAppointments = filteredByDate.get(dayKey) ?? [];

  const dayOfWeek = dateToDayOfWeek(selectedDay);

  // Bloques del dia seleccionado: recurrentes + puntuales, respetando el filtro de médico
  const dayAvailability = useMemo(
    () =>
      availabilityBlocks.filter(
        (b) =>
          ((b.specific_date === null && b.day_of_week === dayOfWeek) ||
            b.specific_date === dayKey) &&
          (filters.professionalId === "todos" || b.professional_id === filters.professionalId)
      ),
    [availabilityBlocks, dayOfWeek, dayKey, filters.professionalId]
  );

  // Dots de disponibilidad (respetan el filtro de médico)
  const visibleBlocks = useMemo(
    () =>
      filters.professionalId === "todos"
        ? availabilityBlocks
        : availabilityBlocks.filter((b) => b.professional_id === filters.professionalId),
    [availabilityBlocks, filters.professionalId]
  );

  const availabilityDows = useMemo(
    () =>
      new Set(
        visibleBlocks
          .filter((b) => b.specific_date === null && b.day_of_week !== null)
          .map((b) => b.day_of_week as number)
      ),
    [visibleBlocks]
  );

  const availabilitySpecificDates = useMemo(
    () =>
      new Set(
        visibleBlocks
          .filter((b) => b.specific_date !== null)
          .map((b) => b.specific_date as string)
      ),
    [visibleBlocks]
  );

  // Citas del rango que pasan los filtros → vista de agenda
  const filteredRangeAppts = useMemo(
    () => rangeAppts.filter((a) => matchesFilters(a, filters)),
    [rangeAppts, filters]
  );

  function goToDate(dateStr: string) {
    const d = parseDateInput(dateStr);
    setFilters((f) => ({ ...f, from: "", to: "" }));
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(d);
  }

  return (
    <>
      <CalendarFilters
        professionals={professionals}
        value={filters}
        onChange={setFilters}
        onGoToDate={goToDate}
      />

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
            byDate={filteredByDate}
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

        {/* Panel derecho: agenda (rango activo) o detalle del día */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          {rangeActive && rangeFrom && rangeTo ? (
            <AgendaList
              appointments={filteredRangeAppts}
              loading={rangeLoading}
              from={rangeFrom}
              to={rangeTo}
              onOpenCase={openCase}
            />
          ) : (
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
              onOpenCase={openCase}
            />
          )}
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

      {/* Mismo menú que el panel de casos, abierto desde el calendario */}
      <CaseDetailDialog
        caseItem={detailCase}
        professionals={professionals}
        onOpenChange={(open) => { if (!open) setDetailCase(null); }}
        onSaved={() => void reload()}
      />
    </>
  );
}
