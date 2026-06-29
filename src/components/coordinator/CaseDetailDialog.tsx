import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type {
  ApptModality,
  Appointment,
  Case,
  CaseStatus,
  Profile,
  Urgency,
} from "@/types/database";
import {
  APPT_STATUS_LABEL,
  MODALITY_LABEL,
  PREF_MODALITY_LABEL,
  STABLE_CONN_LABEL,
  STATUS_LABEL,
  URGENCY_LABEL,
  formatDateTime,
} from "@/lib/domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { CalendarPlus } from "lucide-react";

interface Props {
  caseItem: Case | null;
  professionals: Profile[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function CaseDetailDialog({ caseItem, professionals, onOpenChange, onSaved }: Props) {
  const { profile } = useAuth();
  const [urgency, setUrgency] = useState<Urgency>("media");
  const [status, setStatus] = useState<CaseStatus>("nuevo");
  const [assigned, setAssigned] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptWhen, setApptWhen] = useState("");
  const [apptModality, setApptModality] = useState<ApptModality>("videollamada");
  const [apptContactNo, setApptContactNo] = useState("1");
  const [schedulingErr, setSchedulingErr] = useState<string | null>(null);

  useEffect(() => {
    if (!caseItem) return;
    setUrgency(caseItem.urgency);
    setStatus(caseItem.status);
    setAssigned(caseItem.assigned_professional_id ?? "");
    setNotes(caseItem.notes ?? "");
    setFeedback(null);
    setSchedulingErr(null);
    void loadAppointments(caseItem.id);
  }, [caseItem]);

  async function loadAppointments(caseId: string) {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("case_id", caseId)
      .order("scheduled_at", { ascending: true });
    setAppointments((data as Appointment[]) ?? []);
  }

  if (!caseItem) return null;

  async function saveCase() {
    if (!caseItem) return;
    setSaving(true);
    setFeedback(null);
    let nextStatus = status;
    if (assigned && status === "nuevo") nextStatus = "asignado";

    const { error } = await supabase
      .from("cases")
      .update({ urgency, status: nextStatus, assigned_professional_id: assigned || null, notes: notes.trim() || null })
      .eq("id", caseItem.id);

    if (!error && profile) {
      await supabase.from("case_events").insert({
        case_id: caseItem.id,
        event_type: "actualizacion",
        detail: `Urgencia: ${URGENCY_LABEL[urgency]}, estado: ${STATUS_LABEL[nextStatus]}`,
        created_by: profile.id,
      });
    }
    setSaving(false);
    if (error) { setFeedback("No se pudo guardar."); return; }
    setStatus(nextStatus);
    setFeedback("Cambios guardados.");
    onSaved();
  }

  async function addAppointment() {
    if (!caseItem) return;
    setSchedulingErr(null);
    if (!apptWhen) { setSchedulingErr("Indica fecha y hora."); return; }
    if (!assigned) { setSchedulingErr("Primero asigna un profesional y guarda."); return; }
    const { error } = await supabase.from("appointments").insert({
      case_id: caseItem.id,
      professional_id: assigned,
      scheduled_at: new Date(apptWhen).toISOString(),
      modality: apptModality,
      contact_number: Number(apptContactNo),
      created_by: profile?.id ?? null,
    });
    if (error) { setSchedulingErr("No se pudo agendar la cita."); return; }
    setApptWhen("");
    await loadAppointments(caseItem.id);
  }

  return (
    <Dialog open={!!caseItem} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{caseItem.patient_name}</DialogTitle>
          <DialogDescription>Recibido el {formatDateTime(caseItem.created_at)}</DialogDescription>
        </DialogHeader>

        {/* Datos del paciente */}
        <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <Info label="WhatsApp" value={caseItem.whatsapp} />
          {caseItem.email && <Info label="Correo" value={caseItem.email} />}
          <Info label="Edad / Ciudad" value={`${caseItem.patient_age ?? "—"} · ${caseItem.city ?? "—"}`} />
          <Info label="Via preferida" value={PREF_MODALITY_LABEL[caseItem.preferred_modality]} />
          {caseItem.has_stable_conn && (
            <Info label="Conexion estable" value={STABLE_CONN_LABEL[caseItem.has_stable_conn]} />
          )}
          {caseItem.available_days && <Info label="Dias" value={caseItem.available_days} full />}
          {caseItem.available_times && <Info label="Horarios" value={caseItem.available_times} full />}
          {caseItem.availability && <Info label="Detalle horario" value={caseItem.availability} full />}
          {caseItem.observations && <Info label="Observaciones" value={caseItem.observations} full />}
        </div>

        {/* Edicion */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Urgencia">
            <Select value={urgency} onValueChange={(v) => setUrgency(v as Urgency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["alta", "media", "baja"] as Urgency[]).map((u) => (
                  <SelectItem key={u} value={u}>{URGENCY_LABEL[u]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={status} onValueChange={(v) => setStatus(v as CaseStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["nuevo", "asignado", "en_contacto", "cerrado", "derivado"] as CaseStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Profesional">
            <Select value={assigned || "none"} onValueChange={(v) => setAssigned(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || "(sin nombre)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Notas del coordinador">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas..." />
        </Field>

        <div className="flex items-center justify-between gap-2">
          {feedback && <span className="text-sm text-muted-foreground">{feedback}</span>}
          <Button onClick={saveCase} disabled={saving} className="ml-auto">
            {saving && <Spinner className="text-primary-foreground" />} Guardar cambios
          </Button>
        </div>

        {/* Citas */}
        <div className="space-y-3 border-t border-border pt-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarPlus className="size-4 text-accent" /> Citas del caso
          </h4>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aun no hay citas agendadas.</p>
          ) : (
            <ul className="space-y-1.5">
              {appointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span>{formatDateTime(a.scheduled_at)} · {MODALITY_LABEL[a.modality]} (contacto {a.contact_number}/3)</span>
                  <Badge className="border-border bg-secondary text-secondary-foreground">
                    {APPT_STATUS_LABEL[a.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <Input type="datetime-local" value={apptWhen} onChange={(e) => setApptWhen(e.target.value)} aria-label="Fecha y hora" />
            <Select value={apptModality} onValueChange={(v) => setApptModality(v as ApptModality)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["videollamada", "llamada", "presencial"] as ApptModality[]).map((m) => (
                  <SelectItem key={m} value={m}>{MODALITY_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={apptContactNo} onValueChange={setApptContactNo}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>Contacto {n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="accent" onClick={addAppointment}>Agendar</Button>
          </div>
          {schedulingErr && <p role="alert" className="text-sm text-destructive">{schedulingErr}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
