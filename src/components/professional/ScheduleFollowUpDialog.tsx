import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Appointment, ApptModality, AvailabilityBlock, Case } from "@/types/database";
import { MODALITY_LABEL } from "@/lib/domain";
import { useCalendarAppointments } from "@/hooks/useCalendarAppointments";
import { MonthCalendar } from "@/components/coordinator/MonthCalendar";
import {
  buildHourSlots,
  formatDayHeader,
  formatTime,
  getBlocksForDate,
  groupByDate,
  parseDateInput,
  startOfDay,
  timeInRange,
  toDateKey,
  type AppointmentFull,
  type HourSlot,
} from "@/lib/calendarUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  caseItem: Case;
  professionalId: string;
  myBlocks: AvailabilityBlock[];
  existingAppointments: Appointment[];
  onClose: () => void;
  onSaved: () => void;
}

function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

export function ScheduleFollowUpDialog({
  open,
  caseItem,
  professionalId,
  myBlocks,
  existingAppointments,
  onClose,
  onSaved,
}: Props) {
  const [month, setMonth] = useState(() => tomorrow());
  const [selectedDay, setSelectedDay] = useState(() => tomorrow());
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [modality, setModality] = useState<ApptModality>("videollamada");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useCalendarAppointments es el hook "de coordinador": si quien mira esta
  // pantalla es coordinador/admin, RLS le deja ver las citas de TODOS los
  // profesionales. Hay que filtrar explicitamente a este profesional para
  // que los puntos del mes no muestren citas ajenas (mismo patron que
  // useMyAvailability y Profesional.tsx).
  const { appointments: monthAppointments, loading: loadingMonth } = useCalendarAppointments(month);
  const byDate = useMemo(
    () => groupByDate(monthAppointments.filter((a) => a.professional_id === professionalId)),
    [monthAppointments, professionalId]
  );

  const usedNumbers = existingAppointments.map((a) => a.contact_number);
  const maxUsed = usedNumbers.length ? Math.max(...usedNumbers) : 0;
  const nextContact = Math.min(maxUsed + 1, 3);
  const reachedLimit = maxUsed >= 3;

  // Reset al abrir
  useEffect(() => {
    if (open) {
      const t = tomorrow();
      setMonth(t);
      setSelectedDay(t);
      setSelectedStart(null);
      setModality("videollamada");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    setSelectedStart(null);
  }, [selectedDay]);

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
  const isPastDay = startOfDay(selectedDay) < startOfDay(new Date());

  const slotRows = useMemo(() => {
    const dayBlocks = getBlocksForDate(myBlocks, selectedDay);
    const slots = buildHourSlots(dayBlocks);
    const matchedIds = new Set<string>();
    const rows = slots.map((slot) => {
      const appt = dayAppointments.find((a) => timeInRange(formatTime(a.scheduled_at), slot.start, slot.end));
      if (appt) matchedIds.add(appt.id);
      return { slot, appointment: appt };
    });
    const leftover = dayAppointments.filter((a) => !matchedIds.has(a.id));
    return { rows, leftover };
  }, [myBlocks, selectedDay, dayAppointments]);

  async function handleSave() {
    setError(null);
    if (!selectedStart) { setError("Selecciona una franja horaria."); return; }

    const [h, m] = selectedStart.split(":").map(Number);
    const dt = parseDateInput(dayKey);
    dt.setHours(h, m, 0, 0);

    setSaving(true);
    const { error: err } = await supabase.from("appointments").insert({
      case_id: caseItem.id,
      professional_id: professionalId,
      scheduled_at: dt.toISOString(),
      modality,
      contact_number: nextContact,
      created_by: professionalId,
    });
    setSaving(false);

    if (err) {
      setError("No se pudo agendar. Intenta de nuevo.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Agendar seguimiento</DialogTitle>
          <DialogDescription>
            {caseItem.patient_name} · Contacto {nextContact}/3
          </DialogDescription>
        </DialogHeader>

        {reachedLimit ? (
          <p className="text-sm text-muted-foreground">
            Ya se completaron los 3 contactos para este caso.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
              {/* Calendario de mes: igual al del coordinador, con tu propia disponibilidad */}
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

              {/* Panel del día: franjas disponibles + tus citas ya agendadas */}
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-sm font-semibold capitalize text-foreground">
                  {formatDayHeader(selectedDay)}
                </p>

                {isPastDay ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No puedes agendar citas en fechas pasadas. Elige un día futuro en el calendario.
                  </p>
                ) : loadingMonth ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    <Spinner className="size-4" /> Cargando...
                  </div>
                ) : slotRows.rows.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No tienes disponibilidad definida para este día. Cambia la fecha o agrega
                    un bloque en "Mi disponibilidad".
                  </p>
                ) : (
                  <ul className="space-y-1.5" role="list">
                    {slotRows.rows.map(({ slot, appointment }) =>
                      appointment ? (
                        <OccupiedSlotRow key={appointment.id} slot={slot} appointment={appointment} />
                      ) : (
                        <FreeSlotRow
                          key={slot.start}
                          slot={slot}
                          selected={selectedStart === slot.start}
                          onClick={() => setSelectedStart(slot.start)}
                        />
                      )
                    )}
                    {slotRows.leftover.map((a) => (
                      <OccupiedSlotRow key={a.id} slot={{ start: formatTime(a.scheduled_at), end: "" }} appointment={a} />
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Modalidad</Label>
              <Select value={modality} onValueChange={(v) => setModality(v as ApptModality)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["videollamada", "llamada"] as ApptModality[]).map((m) => (
                    <SelectItem key={m} value={m}>{MODALITY_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {!reachedLimit && (
            <Button onClick={handleSave} disabled={saving || !selectedStart}>
              {saving && <Spinner className="text-primary-foreground" />}
              Agendar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FreeSlotRow({
  slot,
  selected,
  onClick,
}: {
  slot: HourSlot;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "border-accent bg-accent/10"
            : "border-dashed border-success/40 bg-success/5 hover:bg-success/10"
        )}
      >
        <span className={cn("w-12 shrink-0 text-xs font-semibold tabular-nums", selected ? "text-accent" : "text-success")}>
          {slot.start}
        </span>
        <span className={cn("flex-1 text-xs font-medium", selected ? "text-accent" : "text-success")}>
          Disponible hasta las {slot.end}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            selected ? "bg-accent/20 text-accent" : "bg-success/15 text-success"
          )}
        >
          <Plus className="size-3" /> {selected ? "Seleccionado" : "Elegir"}
        </span>
      </button>
    </li>
  );
}

function OccupiedSlotRow({ slot, appointment }: { slot: HourSlot; appointment: AppointmentFull }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <span className="w-12 shrink-0 text-xs font-semibold tabular-nums">{slot.start}</span>
      <span className="flex-1 truncate">{appointment.case?.patient_name ?? "Ocupado"}</span>
      <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium">
        Ocupado
      </span>
    </li>
  );
}
