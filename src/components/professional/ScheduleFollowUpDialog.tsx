import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Appointment, ApptModality, AvailabilityBlock, Case } from "@/types/database";
import { MODALITY_LABEL } from "@/lib/domain";
import {
  buildHourSlots,
  dateToDayOfWeek,
  formatTime,
  parseDateInput,
  startOfDay,
  endOfDay,
  timeInRange,
  toDateInputValue,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
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
  const [date, setDate] = useState(() => toDateInputValue(tomorrow()));
  const [occupied, setOccupied] = useState<string[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [modality, setModality] = useState<ApptModality>("videollamada");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedNumbers = existingAppointments.map((a) => a.contact_number);
  const maxUsed = usedNumbers.length ? Math.max(...usedNumbers) : 0;
  const nextContact = Math.min(maxUsed + 1, 3);
  const reachedLimit = maxUsed >= 3;

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setDate(toDateInputValue(tomorrow()));
      setSelectedStart(null);
      setModality("videollamada");
      setError(null);
    }
  }, [open]);

  // Cargar citas propias del dia elegido (para marcar franjas ocupadas)
  useEffect(() => {
    if (!open || !date) return;
    setLoadingDay(true);
    setSelectedStart(null);
    const d = parseDateInput(date);
    supabase
      .from("appointments")
      .select("scheduled_at")
      .eq("professional_id", professionalId)
      .gte("scheduled_at", startOfDay(d).toISOString())
      .lte("scheduled_at", endOfDay(d).toISOString())
      .then(({ data }) => {
        setOccupied(((data as { scheduled_at: string }[]) ?? []).map((a) => formatTime(a.scheduled_at)));
        setLoadingDay(false);
      });
  }, [open, date, professionalId]);

  const slots = useMemo(() => {
    if (!date) return [];
    const dow = dateToDayOfWeek(parseDateInput(date));
    const dayBlocks = myBlocks.filter((b) => b.day_of_week === dow && b.active);
    return buildHourSlots(dayBlocks).filter(
      (s) => !occupied.some((t) => timeInRange(t, s.start, s.end))
    );
  }, [date, myBlocks, occupied]);

  async function handleSave() {
    setError(null);
    if (!selectedStart) { setError("Selecciona una franja horaria."); return; }

    const [h, m] = selectedStart.split(":").map(Number);
    const dt = parseDateInput(date);
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
      <DialogContent className="max-w-md">
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
            <div className="space-y-1.5">
              <Label htmlFor="fu-date">Fecha</Label>
              <Input
                id="fu-date"
                type="date"
                value={date}
                min={toDateInputValue(new Date())}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Franjas disponibles</Label>
              {loadingDay ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Cargando...
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                  No tienes disponibilidad definida (o ya esta ocupada) para este día.
                  Cambia la fecha o agrega un bloque en "Mi disponibilidad".
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      onClick={() => setSelectedStart(s.start)}
                      className={cn(
                        "rounded-md border-2 px-2 py-2 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selectedStart === s.start
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-input bg-background text-foreground hover:bg-secondary"
                      )}
                    >
                      {s.start}
                    </button>
                  ))}
                </div>
              )}
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
