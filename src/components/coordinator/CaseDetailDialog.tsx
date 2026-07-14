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
import { notifyProfessionalAssigned } from "@/lib/notifications";
import { useCalendarAppointments } from "@/hooks/useCalendarAppointments";
import {
  appointmentsInSlot,
  buildHourSlots,
  formatDayHeader,
  formatTime,
  getBlocksForDate,
  groupByDate,
  parseDateInput,
  startOfDay,
  toDateKey,
} from "@/lib/calendarUtils";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle, CalendarPlus, Info as InfoIcon, Mail, MailCheck, Trash2, UserMinus } from "lucide-react";
import { WhatsAppIcon, WhatsAppLink } from "@/components/ui/whatsapp-link";
import { AgeGroupBadges } from "@/components/ui/age-group-badges";
import { MonthCalendar } from "./MonthCalendar";
import { FreeSlotRow, GroupSlotRow, OccupiedSlotRow } from "./DayScheduleSlots";

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
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [notifiedAt, setNotifiedAt] = useState<string | null>(null);
  const [deleteApptId, setDeleteApptId] = useState<string | null>(null);
  const [deletingAppt, setDeletingAppt] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [apptModality, setApptModality] = useState<ApptModality>("videollamada");
  const [apptContactNo, setApptContactNo] = useState("1");
  const [schedulingErr, setSchedulingErr] = useState<string | null>(null);

  const [assignedBlocks, setAssignedBlocks] = useState<AvailabilityBlock[]>([]);

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
    setEmailFeedback(null);
    setNotifiedAt(caseItem.assignment_notified_at);
    setDeleteApptId(null);
    setMonth(new Date());
    setSelectedDay(new Date());
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

  useEffect(() => {
    setSelectedStart(null);
  }, [assigned, selectedDay]);

  // Mismo calendario del coordinador (mes + panel de dia), pero filtrado al
  // profesional actualmente seleccionado en este caso: sin filtro, un
  // coordinador/admin vería via RLS las citas de TODOS los profesionales.
  const { appointments: monthAppointments, loading: loadingMonth, reload: reloadMonth } = useCalendarAppointments(month);
  const byDate = useMemo(
    () => groupByDate(monthAppointments.filter((a) => a.professional_id === assigned)),
    [monthAppointments, assigned]
  );

  const activeAssignedBlocks = useMemo(() => assignedBlocks.filter((b) => b.active), [assignedBlocks]);
  const availabilityDows = useMemo(
    () =>
      new Set(
        activeAssignedBlocks
          .filter((b) => b.specific_date === null && b.day_of_week !== null)
          .map((b) => b.day_of_week as number)
      ),
    [activeAssignedBlocks]
  );
  const availabilitySpecificDates = useMemo(
    () => new Set(activeAssignedBlocks.filter((b) => b.specific_date !== null).map((b) => b.specific_date as string)),
    [activeAssignedBlocks]
  );

  const dayKey = toDateKey(selectedDay);
  const dayAppointments = byDate.get(dayKey) ?? [];
  const isPastDay = startOfDay(selectedDay) < startOfDay(new Date());

  const slotRows = useMemo(() => {
    const dayBlocks = getBlocksForDate(assignedBlocks, selectedDay);
    const slotsList = buildHourSlots(dayBlocks);
    const matchedIds = new Set<string>();
    const rows = slotsList.map((slot) => {
      const matched = appointmentsInSlot(dayAppointments, slot);
      matched.forEach((a) => matchedIds.add(a.id));
      return { slot, appointments: matched };
    });
    const leftover = dayAppointments.filter((a) => !matchedIds.has(a.id));
    return { rows, leftover };
  }, [assignedBlocks, selectedDay, dayAppointments]);

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

  async function handleSendEmail() {
    if (!caseItem || !assigned) return;
    setSendingEmail(true);
    setEmailFeedback(null);
    const result = await notifyProfessionalAssigned(caseItem.id, assigned);
    if (result.ok) {
      const now = new Date().toISOString();
      await supabase
        .from("cases")
        .update({ assignment_notified_at: now })
        .eq("id", caseItem.id);
      setNotifiedAt(now);
      onSaved();
    }
    setSendingEmail(false);
    setEmailFeedback(result.ok ? "Correo enviado." : `No se pudo enviar: ${result.error ?? "error desconocido"}`);
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
    // Refresca la lista para reflejar las citas que el trigger de BD acaba de cancelar.
    await loadAppointments(caseItem.id);
    onSaved();
  }

  async function addAppointment() {
    if (!caseItem) return;
    setSchedulingErr(null);
    if (!assigned) { setSchedulingErr("Primero asigna un profesional y guarda."); return; }
    if (!selectedStart) { setSchedulingErr("Selecciona una franja horaria disponible."); return; }
    const matchingSlot = slotRows.rows.find((r) => r.slot.start === selectedStart)?.slot;
    const [h, m] = selectedStart.split(":").map(Number);
    const dt = parseDateInput(dayKey);
    dt.setHours(h, m, 0, 0);
    const { error } = await supabase.from("appointments").insert({
      case_id: caseItem.id,
      professional_id: assigned,
      scheduled_at: dt.toISOString(),
      modality: apptModality,
      contact_number: Number(apptContactNo),
      created_by: profile?.id ?? null,
      is_group: matchingSlot?.is_group ?? false,
    });
    if (error) {
      setSchedulingErr(
        /mezclar|maximo de 10|ya esta ocupado/i.test(error.message) ? error.message : "No se pudo agendar la cita."
      );
      return;
    }
    setSelectedStart(null);
    await Promise.all([loadAppointments(caseItem.id), reloadMonth()]);
  }

  async function handleDeleteAppointment(id: string) {
    if (!caseItem) return;
    setDeletingAppt(true);
    const { data, error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .select("id");
    setDeletingAppt(false);
    setDeleteApptId(null);
    if (error || !data || data.length === 0) {
      setSchedulingErr("No se pudo borrar la cita (permisos).");
      return;
    }
    await Promise.all([loadAppointments(caseItem.id), reloadMonth()]);
    onSaved();
  }

  const isAssigned = !!caseItem.assigned_professional_id;
  // El correo solo se envia manualmente y solo si la asignacion ya esta guardada
  // (evita notificar sobre un cambio de profesional que aun no se ha confirmado).
  const canSendEmail = !!assigned && assigned === caseItem.assigned_professional_id;

  return (
    <Dialog open={!!caseItem} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{caseItem.patient_name}</DialogTitle>
          <DialogDescription>Recibido el {formatDateTime(caseItem.created_at)}</DialogDescription>
        </DialogHeader>

        {/* Datos del paciente */}
        <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">WhatsApp</p>
            <WhatsAppLink phone={caseItem.whatsapp} />
          </div>
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
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-flex items-center gap-1.5">
                      {p.full_name || "(sin nombre)"}
                      <AgeGroupBadges groups={p.age_groups} short />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {professionalLocked && (
              <p className="text-xs text-muted-foreground">
                Bloqueado al profesional actual: el caso ya tiene una segunda cita.
              </p>
            )}
            {isAssigned && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendEmail}
                  disabled={!canSendEmail || sendingEmail}
                  className="gap-1.5"
                  title={!canSendEmail ? "Guarda la asignación antes de enviar el correo." : undefined}
                >
                  {sendingEmail ? <Spinner className="size-3.5" /> : <Mail className="size-3.5" />}
                  Enviar correo al profesional
                </Button>
                {notifiedAt ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-success">
                    <MailCheck className="size-3.5" />
                    Enviado el {formatDateTime(notifiedAt)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-warning-foreground">
                    Aun no se ha enviado el correo a este profesional.
                  </p>
                )}
                {emailFeedback && (
                  <p className="mt-1 text-xs text-muted-foreground">{emailFeedback}</p>
                )}
              </div>
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
                <li key={a.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{formatDateTime(a.scheduled_at)} · {MODALITY_LABEL[a.modality]} (contacto {a.contact_number}/3)</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={waLink(caseItem.whatsapp, citaAsignadaMsg(a.scheduled_at))}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir WhatsApp con el mensaje de la cita"
                        className="inline-flex items-center gap-1 rounded-md border border-whatsapp/40 px-2 py-1 text-xs font-medium text-whatsapp transition-colors hover:bg-whatsapp/10"
                      >
                        <WhatsAppIcon className="size-3.5" /> <span className="hidden xs:inline">Enviar por WhatsApp</span><span className="xs:hidden">WhatsApp</span>
                      </a>
                      <Badge className="border-border bg-secondary text-secondary-foreground">
                        {APPT_STATUS_LABEL[a.status]}
                      </Badge>
                      <button
                        type="button"
                        title="Borrar cita"
                        onClick={() => setDeleteApptId(deleteApptId === a.id ? null : a.id)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  {deleteApptId === a.id && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                      <span className="text-xs text-destructive">
                        ¿Borrar esta cita permanentemente? Desaparecerá del calendario.
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setDeleteApptId(null)} disabled={deletingAppt}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDeleteAppointment(a.id)}
                          disabled={deletingAppt}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deletingAppt && <Spinner className="text-destructive-foreground" />}
                          Borrar
                        </Button>
                      </div>
                    </div>
                  )}
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
              {/* Calendario del coordinador, filtrado a la disponibilidad del profesional asignado */}
              <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
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

                <div className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-semibold capitalize text-foreground">
                    {formatDayHeader(selectedDay)}
                  </p>

                  {isPastDay ? (
                    <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                      No se pueden agendar citas en fechas pasadas. Elige un día futuro en el calendario.
                    </p>
                  ) : loadingMonth ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <Spinner className="size-4" /> Cargando...
                    </div>
                  ) : slotRows.rows.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                      Este profesional no tiene disponibilidad definida para este día. Cambia la
                      fecha o revisa su disponibilidad.
                    </p>
                  ) : (
                    <ul className="space-y-1.5" role="list">
                      {slotRows.rows.map(({ slot, appointments: slotAppts }) =>
                        slot.is_group ? (
                          <GroupSlotRow
                            key={slot.start}
                            slot={slot}
                            appointments={slotAppts}
                            selected={selectedStart === slot.start}
                            disableAdd={slotAppts.some((a) => a.case_id === caseItem.id && a.status === "programada")}
                            onAdd={() => setSelectedStart(slot.start)}
                          />
                        ) : slotAppts.length > 0 ? (
                          <OccupiedSlotRow key={slotAppts[0].id} slot={slot} appointment={slotAppts[0]} />
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
                        <OccupiedSlotRow key={a.id} slot={{ start: formatTime(a.scheduled_at), end: "", is_group: false }} appointment={a} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
