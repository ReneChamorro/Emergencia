import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfessionals } from "@/hooks/useProfessionals";
import { useCalendarAppointments, useRangeAppointments } from "@/hooks/useCalendarAppointments";
import { useAllAvailabilityBlocks } from "@/hooks/useAvailabilityBlocks";
import { useOpenCases } from "@/hooks/useOpenCases";
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
import { OpenCasesPanel } from "./OpenCasesPanel";
import {
  CalendarFilters,
  EMPTY_FILTERS,
  isRangeActive,
  type CalendarFilterState,
} from "./CalendarFilters";
import { Spinner } from "@/components/ui/spinner";

function matchesProfessional(a: AppointmentFull, f: CalendarFilterState): boolean {
  return f.professionalId === "todos" || a.professional_id === f.professionalId;
}

/** Franja + estado + urgencia (todo excepto médico). Se aplica a nivel de fila, no de ocupación. */
function matchesQualitative(a: AppointmentFull, f: CalendarFilterState): boolean {
  if (f.franja !== "todas" && timeOfDay(a.scheduled_at) !== f.franja) return false;
  if (f.apptStatus !== "todas" && a.status !== f.apptStatus) return false;
  if (f.urgency !== "todas" && (a.case?.urgency ?? null) !== f.urgency) return false;
  return true;
}

/** Predicado completo aplicado a una cita (médico + franja + estado + urgencia). */
function matchesFilters(a: AppointmentFull, f: CalendarFilterState): boolean {
  return matchesProfessional(a, f) && matchesQualitative(a, f);
}

export function CalendarioTab() {
  const { profile } = useAuth();
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [slotPreset, setSlotPreset] = useState<{ professionalId: string; time: string } | null>(null);
  const [filters, setFilters] = useState<CalendarFilterState>(EMPTY_FILTERS);
  const [detailCase, setDetailCase] = useState<Case | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const { professionals } = useProfessionals();
  const { appointments, loading, reload } = useCalendarAppointments(month);
  const { blocks: availabilityBlocks } = useAllAvailabilityBlocks();
  const { cases: openCasesList, loading: openCasesLoading, reload: reloadOpenCases } = useOpenCases();

  const selectedOpenCase = openCasesList.find((c) => c.id === selectedCaseId) ?? null;

  // Abre el mismo diálogo del panel de casos al clickear una cita en el calendario.
  async function openCase(caseId: string) {
    const { data } = await supabase.from("cases").select("*").eq("id", caseId).single();
    if (data) setDetailCase(data as Case);
  }

  // Coloca directamente el caso seleccionado en "Casos abiertos" en el horario clickeado.
  async function assignSelectedCaseToSlot(professionalId: string, time: string) {
    if (!selectedCaseId || assigning) return;
    setAssigning(true);
    setAssignError(null);

    const [hours, minutes] = time.split(":").map(Number);
    const dt = new Date(selectedDay);
    dt.setHours(hours, minutes, 0, 0);

    const { error: apptErr } = await supabase.from("appointments").insert({
      case_id: selectedCaseId,
      professional_id: professionalId,
      scheduled_at: dt.toISOString(),
      modality: "videollamada",
      contact_number: 1,
      created_by: profile?.id ?? null,
    });

    if (apptErr) {
      setAssigning(false);
      setAssignError("No se pudo agendar la cita. Intenta de nuevo.");
      return;
    }

    const { error: caseErr } = await supabase
      .from("cases")
      .update({ assigned_professional_id: professionalId, status: "asignado" })
      .eq("id", selectedCaseId);

    setAssigning(false);

    if (caseErr) {
      setAssignError(`La cita se creó, pero no se pudo asignar el caso: ${caseErr.message}`);
      return;
    }

    setSelectedCaseId(null);
    void reload();
    void reloadOpenCases();
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

  // Citas del día filtradas SOLO por médico (verdad de ocupación de horarios).
  // Franja/estado/urgencia se aplican como filtro de fila dentro de DayDetailPanel,
  // nunca deben hacer que un horario ocupado se muestre como libre.
  const dayAppointmentsByProfessional = useMemo(() => {
    const list = appointments.filter((a) => matchesProfessional(a, filters));
    return groupByDate(list);
  }, [appointments, filters]);
  const dayAppointments = dayAppointmentsByProfessional.get(dayKey) ?? [];

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
      <OpenCasesPanel
        cases={openCasesList}
        loading={openCasesLoading}
        selectedCaseId={selectedCaseId}
        onSelect={(id) => {
          setSelectedCaseId(id);
          setAssignError(null);
        }}
        error={assignError}
      />

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
              franja={filters.franja}
              rowFilter={(a) => matchesQualitative(a, filters)}
              onNewAppointment={() => {
                setSlotPreset(null);
                setScheduleOpen(true);
              }}
              onSlotClick={(professionalId, time) => {
                if (selectedCaseId) {
                  void assignSelectedCaseToSlot(professionalId, time);
                } else {
                  setSlotPreset({ professionalId, time });
                  setScheduleOpen(true);
                }
              }}
              onOpenCase={openCase}
              pendingCaseName={selectedOpenCase?.patient_name}
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
