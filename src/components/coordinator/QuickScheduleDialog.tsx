import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { ApptModality, AvailabilityBlock, Case, Profile } from "@/types/database";
import { MODALITY_LABEL } from "@/lib/domain";
import { formatBlockTime } from "@/lib/calendarUtils";
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
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  selectedDate: Date;
  professionals: Profile[];
  /** Bloques de disponibilidad de todos los profesionales para el dia seleccionado. */
  availability: AvailabilityBlock[];
  /** Pre-seleccionar profesional + hora (al hacer click en una franja libre del panel del dia). */
  presetProfessionalId?: string;
  presetTime?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function QuickScheduleDialog({
  open,
  selectedDate,
  professionals,
  availability,
  presetProfessionalId,
  presetTime,
  onClose,
  onSaved,
}: Props) {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [caseId, setCaseId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [time, setTime] = useState("09:00");
  const [modality, setModality] = useState<ApptModality>("videollamada");
  const [contactNo, setContactNo] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseLocked, setCaseLocked] = useState(false);

  // Cargar casos activos al abrir
  useEffect(() => {
    if (!open) return;
    supabase
      .from("cases")
      .select("id, patient_name, whatsapp, status, urgency, assigned_professional_id")
      .in("status", ["nuevo", "asignado", "en_contacto"])
      .order("patient_name", { ascending: true })
      .then(({ data }) => setCases((data as Case[]) ?? []));
  }, [open]);

  // Al elegir un caso: preseleccionar su profesional asignado y detectar si esta
  // bloqueado (ya tiene una 2.ª cita → no se puede cambiar de profesional).
  useEffect(() => {
    if (!caseId) { setCaseLocked(false); return; }
    const c = cases.find((x) => x.id === caseId);
    if (c?.assigned_professional_id) setProfessionalId(c.assigned_professional_id);
    let cancelled = false;
    supabase
      .from("appointments")
      .select("contact_number")
      .eq("case_id", caseId)
      .then(({ data }) => {
        if (cancelled) return;
        const locked = ((data as { contact_number: number }[]) ?? []).some((a) => a.contact_number >= 2);
        setCaseLocked(locked);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, cases]);

  // Inicializar/reset al abrir o cerrar
  useEffect(() => {
    if (open) {
      setProfessionalId(presetProfessionalId ?? "");
      setTime(presetTime ?? "09:00");
    } else {
      setCaseId("");
      setProfessionalId("");
      setTime("09:00");
      setModality("videollamada");
      setContactNo("1");
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetProfessionalId, presetTime]);

  async function handleSave() {
    setError(null);
    if (!caseId) { setError("Selecciona un caso."); return; }
    if (!professionalId) { setError("Selecciona un profesional."); return; }
    if (!time) { setError("Indica la hora."); return; }

    // Construir ISO a partir del dia seleccionado + hora elegida
    const [hours, minutes] = time.split(":").map(Number);
    const dt = new Date(selectedDate);
    dt.setHours(hours, minutes, 0, 0);

    setSaving(true);
    const { error: err } = await supabase.from("appointments").insert({
      case_id: caseId,
      professional_id: professionalId,
      scheduled_at: dt.toISOString(),
      modality,
      contact_number: Number(contactNo),
      created_by: profile?.id ?? null,
    });

    if (err) {
      setSaving(false);
      setError("No se pudo agendar. Intenta de nuevo.");
      return;
    }

    // Asignar el caso al profesional para que le aparezca en su panel
    // ("Mis casos" filtra por assigned_professional_id via RLS).
    const selectedCase = cases.find((c) => c.id === caseId);
    const nextStatus = selectedCase?.status === "nuevo" ? "asignado" : selectedCase?.status;
    const { error: caseErr } = await supabase
      .from("cases")
      .update({ assigned_professional_id: professionalId, status: nextStatus })
      .eq("id", caseId);

    setSaving(false);

    if (caseErr) {
      // La cita SI se creo, pero el caso no quedo asignado: avisar con el motivo real.
      setError(`La cita se creo, pero no se pudo asignar el caso: ${caseErr.message}`);
      return;
    }

    onSaved();
    onClose();
  }

  const dateLabel = selectedDate.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const professionalBlocks = useMemo(
    () => availability.filter((b) => b.professional_id === professionalId),
    [availability, professionalId]
  );

  // Avisa (no bloquea) si la hora elegida cae fuera de los bloques del profesional.
  const outsideAvailability = useMemo(() => {
    if (!professionalId || !time) return false;
    if (professionalBlocks.length === 0) return false;
    const t = time; // "HH:MM"
    return !professionalBlocks.some(
      (b) => t >= formatBlockTime(b.start_time) && t < formatBlockTime(b.end_time)
    );
  }, [professionalId, time, professionalBlocks]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
          <DialogDescription className="capitalize">{dateLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Caso */}
          <div className="space-y-1.5">
            <Label>Caso / Paciente</Label>
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un caso..." />
              </SelectTrigger>
              <SelectContent>
                {cases.length === 0 && (
                  <SelectItem value="__empty__" disabled>
                    Sin casos activos
                  </SelectItem>
                )}
                {cases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.patient_name}
                    {c.whatsapp ? ` · ${c.whatsapp}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Profesional */}
          <div className="space-y-1.5">
            <Label>Profesional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId} disabled={caseLocked}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un profesional..." />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || "(sin nombre)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {caseLocked && (
              <p className="text-xs text-muted-foreground">
                Este caso ya tiene una segunda cita: queda fijo al profesional asignado.
              </p>
            )}
          </div>

          {/* Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Hora</Label>
              <Input
                id="appt-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            {/* Numero de contacto */}
            <div className="space-y-1.5">
              <Label>Contacto</Label>
              <Select value={contactNo} onValueChange={setContactNo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Contacto {n}/3
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Aviso de disponibilidad */}
          {professionalId && professionalBlocks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {professionalBlocks.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                >
                  Disponible {formatBlockTime(b.start_time)}–{formatBlockTime(b.end_time)}
                </span>
              ))}
            </div>
          )}
          {outsideAvailability && (
            <p className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Esta hora cae fuera del horario disponible del profesional. Puedes
              agendar igual si es necesario.
            </p>
          )}
          {professionalId && professionalBlocks.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Este profesional no definió disponibilidad para este día.
            </p>
          )}

          {/* Modalidad */}
          <div className="space-y-1.5">
            <Label>Modalidad</Label>
            <Select value={modality} onValueChange={(v) => setModality(v as ApptModality)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["videollamada", "llamada"] as ApptModality[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODALITY_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Spinner className="text-primary-foreground" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
