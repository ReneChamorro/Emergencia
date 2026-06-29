import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { ApptModality, Case, Profile } from "@/types/database";
import { MODALITY_LABEL } from "@/lib/domain";
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

interface Props {
  open: boolean;
  selectedDate: Date;
  professionals: Profile[];
  onClose: () => void;
  onSaved: () => void;
}

export function QuickScheduleDialog({
  open,
  selectedDate,
  professionals,
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

  // Cargar casos activos al abrir
  useEffect(() => {
    if (!open) return;
    supabase
      .from("cases")
      .select("id, patient_name, whatsapp, status, urgency")
      .in("status", ["nuevo", "asignado", "en_contacto"])
      .order("patient_name", { ascending: true })
      .then(({ data }) => setCases((data as Case[]) ?? []));
  }, [open]);

  // Reset al cambiar dia o cerrar
  useEffect(() => {
    if (!open) {
      setCaseId("");
      setProfessionalId("");
      setTime("09:00");
      setModality("videollamada");
      setContactNo("1");
      setError(null);
    }
  }, [open]);

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
    setSaving(false);

    if (err) {
      setError("No se pudo agendar. Intenta de nuevo.");
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
            <Select value={professionalId} onValueChange={setProfessionalId}>
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

          {/* Modalidad */}
          <div className="space-y-1.5">
            <Label>Modalidad</Label>
            <Select value={modality} onValueChange={(v) => setModality(v as ApptModality)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["videollamada", "llamada", "presencial"] as ApptModality[]).map((m) => (
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
