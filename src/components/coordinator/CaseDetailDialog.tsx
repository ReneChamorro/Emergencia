import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type {
  ApptModality,
  Appointment,
  AvailabilityBlock,
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
  citaAsignadaMsg,
  formatDateTime,
  waLink,
} from "@/lib/domain";
import {
  buildHourSlots,
  endOfDay,
  formatTime,
  getBlocksForDate,
  parseDateInput,
  startOfDay,
  timeInRange,
  toDateInputValue,
} from "@/lib/calendarUtils";
import { cn } from "@/lib/utils";
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
import { AlertTriangle, CalendarPlus, Info as InfoIcon, MessageCircle, Trash2, UserMinus } from "lucide-react";

interface Props {
  caseItem: Case | null;
  professionals: Profile[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

type Confirm = "delete" | "unassign" | null;

export function CaseDetailDialog({ caseItem, professionals, onOpenChange, onSaved }: Props) {
  const { profile } = useAuth();
  const [urgency, setUrgency] = useState<Urgency>("media");
  const [status, setStatus] = useState<CaseStatus>("nuevo");
  const [assigned, setAssigned] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptDate, setApptDate] = useState(() => toDateInputValue(new Date()));
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [apptModality, setApptModality] = useState<ApptModality>("videollamada");
  const [apptContactNo, setApptContactNo] = useState("1");
  const [schedulingErr, setSchedulingErr] = useState<string | null>(null);

  const [assignedBlocks, setAssignedBlocks] = useState<AvailabilityBlock[]>([]);
  const [occupied, setOccupied] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!caseItem) return;
    setUrgency(caseItem.urgency);
    setStatus(caseItem.status);
    setAssigned(caseItem.assigned_professional_id ?? "");
    setNotes(caseItem.notes ?? "");
    setFeedback(null);
    setConfirm(null);
    setSchedulingErr(null);
    setSelectedStart(null);
    setApptDate(toDateInputValue(new Date()));
    void loadAppointments(caseItem.id);
  }, [caseItem]);

  async function loadAppointments(caseId: string) {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("case_id", caseId)
      .order("scheduled_at", { ascending: true });
    const list = (data as Appointment[]) ?? [];
    setAppointments(list);
    // Pre-seleccionar el siguiente numero de contacto
    const maxContact = list.length ? Math.max(...list.map((a) => a.contact_number)) : 0;
    setApptContactNo(String(Math.min(maxContact + 1, 3)));
  }

  // Cargar los bloques de disponibilidad del profesional asignado
  useEffect(() => {
    if (!assigned) { setAssignedBlocks([]); return; }
    let cancelled = false;
    supabase
      .from("availability_blocks")
      .select("*")
      .eq("professional_id", assigned)
      .then(({ data }) => {
        if (!cancelled) setAssignedBlocks((data as AvailabilityBlock[]) ?? []);
      });
    return () => { cancelled = true; };
  }, [assigned]);

  // Cargar las citas ocupadas del profesional para la fecha elegida
  useEffect(() => {
    if (!assigned || !apptDate) { setOccupied([]); return; }
    let cancelled = false;
    setLoadingSlots(true);
    setSelectedStart(null);
    const d = parseDateInput(apptDate);
    supabase
      .from("appointments")
      .select("scheduled_at")
      .eq("professional_id", assigned)
      .gte("scheduled_at", startOfDay(d).toISOString())
      .lte("scheduled_at", endOfDay(d).toISOString())
      .then(({ data }) => {
        if (cancelled) return;
        setOccupied(((data as { scheduled_at: string }[]) ?? []).map((a) => formatTime(a.scheduled_at)));
        setLoadingSlots(false);
      });
    return () => { cancelled = true; };
  }, [assigned, apptDate]);

  const slots = useMemo(() => {
    if (!apptDate || assignedBlocks.length === 0) return [];
    const dayBlocks = getBlocksForDate(assignedBlocks, parseDateInput(apptDate));
    return buildHourSlots(dayBlocks).filter(
      (s) => !occupied.some((t) => timeInRange(t, s.start, s.end))
    );
  }, [apptDate, assignedBlocks, occupied]);

  // Bloqueo de profesional: si ya hay una 2.ª cita (contacto >= 2), no se puede reasignar.
  const professionalLocked = appointments.some((a) => a.contact_number >= 2);

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
    if (error) {
      setFeedback(
        /no se puede cambiar de profesional/i.test(error.message)
          ? "No se puede cambiar de profesional: el caso ya tiene una segunda cita agendada."
          : "No se pudo guardar."
      );
      return;
    }
    setStatus(nextStatus);
    setFeedback("Cambios guardados.");
    onSaved();
  }

  async function handleDelete() {
    if (!caseItem) return;
    setActing(true);
    setFeedback(null);
    // .select() para detectar el fallo silencioso de RLS (0 filas, sin error).
    const { data, error } = await supabase
      .from("cases")
      .delete()
      .eq("id", caseItem.id)
      .select("id");
    setActing(false);
    if (error || !data || data.length === 0) {
      setConfirm(null);
      setFeedback("No se pudo eliminar el caso (permisos). Contacta al administrador.");
      return;
    }
    onSaved();
    onOpenChange(false);
  }

  async function handleUnassign() {
    if (!caseItem) return;
    setActing(true);
    await supabase
      .from("cases")
      .update({ assigned_professional_id: null, status: "nuevo" })
      .eq("id", caseItem.id);
    setActing(false);
    setConfirm(null);
    setAssigned("");
    setStatus("nuevo");
    setFeedback("Caso desasignado y devuelto a 'Nuevo'.");
    onSaved();
  }

  async function addAppointment() {
    if (!caseItem) return;
    setSchedulingErr(null);
    if (!assigned) { setSchedulingErr("Primero asigna un profesional y guarda."); return; }
    if (!selectedStart) { setSchedulingErr("Selecciona una franja horaria disponible."); return; }
    const [h, m] = selectedStart.split(":").map(Number);
    const dt = parseDateInput(apptDate);
    dt.setHours(h, m, 0, 0);
    const { error } = await supabase.from("appointments").insert({
      case_id: caseItem.id,
      professional_id: assigned,
      scheduled_at: dt.toISOString(),
      modality: apptModality,
      contact_number: Number(apptContactNo),
      created_by: profile?.id ?? null,
    });
    if (error) { setSchedulingErr("No se pudo agendar la cita."); return; }
    setOccupied((prev) => [...prev, selectedStart]);
    setSelectedStart(null);
    await loadAppointments(caseItem.id);
  }

  const isAssigned = !!caseItem.assigned_professional_id;

  return (
    <Dialog open={!!caseItem} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{caseItem.patient_name}</DialogTitle>
          <DialogDescription>Recibido el {formatDateTime(caseItem.created_at)}</DialogDescription>
        </DialogHeader>

        {/* Datos del paciente */}
        <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <InfoRow label="WhatsApp" value={caseItem.whatsapp} />
          {caseItem.email && <InfoRow label="Correo" value={caseItem.email} />}
          <InfoRow label="Edad / Ciudad" value={`${caseItem.patient_age ?? "—"} · ${caseItem.city ?? "—"}`} />
          <InfoRow label="Via preferida" value={PREF_MODALITY_LABEL[caseItem.preferred_modality]} />
          {caseItem.has_stable_conn && (
            <InfoRow label="Conexion estable" value={STABLE_CONN_LABEL[caseItem.has_stable_conn]} />
          )}
          {caseItem.available_days && <InfoRow label="Dias" value={caseItem.available_days} full />}
          {caseItem.available_times && <InfoRow label="Horarios" value={caseItem.available_times} full />}
          {caseItem.availability && <InfoRow label="Detalle horario" value={caseItem.availability} full />}
          {caseItem.observations && <InfoRow label="Observaciones" value={caseItem.observations} full />}
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
            <Select
              value={assigned || "none"}
              onValueChange={(v) => setAssigned(v === "none" ? "" : v)}
              disabled={professionalLocked}
            >
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || "(sin nombre)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {professionalLocked && (
              <p className="text-xs text-muted-foreground">
                Bloqueado al profesional actual: el caso ya tiene una segunda cita.
              </p>
            )}
          </Field>
        </div>

        <Field label="Notas del coordinador">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas..." />
        </Field>

        {/* Fila de acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {isAssigned && !confirm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirm("unassign")}
                className="gap-1.5 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
              >
                <UserMinus className="size-3.5" />
                Desasignar
              </Button>
            )}
            {!confirm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirm("delete")}
                className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Eliminar caso
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            {feedback && <span className="text-sm text-muted-foreground">{feedback}</span>}
            <Button onClick={saveCase} disabled={saving || !!confirm}>
              {saving && <Spinner className="text-primary-foreground" />} Guardar cambios
            </Button>
          </div>
        </div>

        {/* Panel de confirmacion */}
        {confirm === "delete" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">¿Eliminar este caso permanentemente?</p>
                <p className="mt-0.5 text-muted-foreground">
                  Se borrará el caso y <strong>todas sus citas</strong> de la base de datos.
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm(null)} disabled={acting}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                disabled={acting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {acting && <Spinner className="text-destructive-foreground" />}
                Eliminar permanentemente
              </Button>
            </div>
          </div>
        )}

        {confirm === "unassign" && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-foreground">¿Desasignar al profesional?</p>
                <p className="mt-0.5 text-muted-foreground">
                  El caso <strong>no se borrará</strong>. Solo se quitará la asignación al profesional
                  y el estado volverá a "Nuevo" para poder reasignarlo.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm(null)} disabled={acting}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleUnassign} disabled={acting}>
                {acting && <Spinner className="text-primary-foreground" />}
                Confirmar desasignación
              </Button>
            </div>
          </div>
        )}

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
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span>{formatDateTime(a.scheduled_at)} · {MODALITY_LABEL[a.modality]} (contacto {a.contact_number}/3)</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={waLink(caseItem.whatsapp, citaAsignadaMsg(a.scheduled_at))}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-success/40 px-2 py-1 text-xs font-medium text-success transition-colors hover:bg-success/10"
                    >
                      <MessageCircle className="size-3.5" /> Enviar por WhatsApp
                    </a>
                    <Badge className="border-border bg-secondary text-secondary-foreground">
                      {APPT_STATUS_LABEL[a.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!assigned ? (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              Asigna un profesional y guarda los cambios para poder agendar una cita dentro de su
              disponibilidad.
            </p>
          ) : (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_150px_140px]">
                <div className="space-y-1.5">
                  <Label htmlFor="appt-date">Fecha</Label>
                  <Input
                    id="appt-date"
                    type="date"
                    value={apptDate}
                    min={toDateInputValue(new Date())}
                    onChange={(e) => setApptDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Modalidad</Label>
                  <Select value={apptModality} onValueChange={(v) => setApptModality(v as ApptModality)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["videollamada", "llamada"] as ApptModality[]).map((m) => (
                        <SelectItem key={m} value={m}>{MODALITY_LABEL[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Contacto</Label>
                  <Select value={apptContactNo} onValueChange={setApptContactNo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>Contacto {n}/3</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Franjas disponibles</Label>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Spinner className="size-4" /> Cargando...
                  </div>
                ) : slots.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    Este profesional no tiene disponibilidad (o ya está ocupada) para este día.
                    Cambia la fecha o revisa su disponibilidad.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
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

              <div className="flex justify-end">
                <Button variant="accent" onClick={addAppointment} disabled={!selectedStart}>
                  Agendar
                </Button>
              </div>
            </div>
          )}
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

function InfoRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
