import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Appointment, ApptStatus, AvailabilityBlock, Case, CaseStatus } from "@/types/database";
import {
  APPT_STATUS_LABEL,
  MODALITY_LABEL,
  PREF_MODALITY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
  URGENCY_ORDER,
  citaAsignadaMsg,
  formatDateTime,
  waLink,
} from "@/lib/domain";
import { useMyAvailability } from "@/hooks/useAvailabilityBlocks";
import { StaffLayout } from "@/components/StaffLayout";
import { AvailabilityEditor } from "@/components/professional/AvailabilityEditor";
import { AgeGroupsSettings } from "@/components/professional/AgeGroupsSettings";
import { ScheduleFollowUpDialog } from "@/components/professional/ScheduleFollowUpDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FullPageSpinner, Spinner } from "@/components/ui/spinner";
import { WhatsAppIcon, WhatsAppLink } from "@/components/ui/whatsapp-link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CalendarClock, CalendarPlus, UserMinus } from "lucide-react";

export default function Profesional() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const { blocks: myBlocks } = useMyAvailability();

  async function load() {
    if (!profile?.id) return;
    setLoading(true);
    const [caseRes, apptRes] = await Promise.all([
      supabase
        .from("cases")
        .select("*")
        .eq("assigned_professional_id", profile.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*")
        .eq("professional_id", profile.id)
        .order("scheduled_at", { ascending: true }),
    ]);
    const list = ((caseRes.data as Case[]) ?? []).sort(
      (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    );
    setCases(list);
    setAppointments((apptRes.data as Appointment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <FullPageSpinner label="Cargando tus casos..." />;

  const activeCases = cases.filter((c) => c.status !== "cerrado" && c.status !== "derivado");

  return (
    <StaffLayout
      title={`Hola${profile?.full_name ? ", " + profile.full_name.split(" ")[0] : ""}`}
      subtitle="Casos asignados a ti. Atencion focalizada: 1 a 3 contactos."
    >
      <Tabs defaultValue="casos">
        <TabsList className="mb-6">
          <TabsTrigger value="casos">Mis casos</TabsTrigger>
          <TabsTrigger value="disponibilidad">Mi disponibilidad</TabsTrigger>
        </TabsList>

        <TabsContent value="casos">
          <AgeGroupsSettings />
          {cases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aun no tienes casos asignados. El equipo coordinador te asignara pacientes pronto.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeCases.length === 0 && (
                <p className="text-sm text-muted-foreground">No tienes casos activos. Mostrando historial.</p>
              )}
              {cases.map((c) => (
                <ProfessionalCaseCard
                  key={c.id}
                  caseItem={c}
                  appointments={appointments.filter((a) => a.case_id === c.id)}
                  myBlocks={myBlocks}
                  onChanged={() => void load()}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="disponibilidad">
          <AvailabilityEditor />
        </TabsContent>
      </Tabs>
    </StaffLayout>
  );
}

function ProfessionalCaseCard({
  caseItem,
  appointments,
  myBlocks,
  onChanged,
}: {
  caseItem: Case;
  appointments: Appointment[];
  myBlocks: AvailabilityBlock[];
  onChanged: () => void;
}) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<CaseStatus>(caseItem.status);
  const [notes, setNotes] = useState(caseItem.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  const hasSeenFirst = appointments.some((a) => a.status === "realizada");
  const maxContact = appointments.length
    ? Math.max(...appointments.map((a) => a.contact_number))
    : 0;
  const caseOpen = caseItem.status !== "cerrado" && caseItem.status !== "derivado";
  const reachedLimit = maxContact >= 3;

  async function save() {
    setSaving(true);
    setFeedback(null);
    const { error } = await supabase
      .from("cases")
      .update({ status, notes: notes.trim() || null })
      .eq("id", caseItem.id);
    if (!error && profile) {
      await supabase.from("case_events").insert({
        case_id: caseItem.id,
        event_type: "profesional",
        detail: `Estado: ${STATUS_LABEL[status]}`,
        created_by: profile.id,
      });
    }
    setSaving(false);
    setFeedback(error ? "No se pudo guardar." : "Guardado.");
    if (!error) onChanged();
  }

  async function handleUnassign() {
    setUnassigning(true);
    await supabase
      .from("cases")
      .update({ assigned_professional_id: null, status: "nuevo" })
      .eq("id", caseItem.id);
    setUnassigning(false);
    setConfirmUnassign(false);
    onChanged();
  }

  async function setApptStatus(id: string, newStatus: ApptStatus) {
    await supabase.from("appointments").update({ status: newStatus }).eq("id", id);
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{caseItem.patient_name}</CardTitle>
          <div className="flex gap-2">
            <Badge className={URGENCY_BADGE[caseItem.urgency]}>{URGENCY_LABEL[caseItem.urgency]}</Badge>
            <Badge className={STATUS_BADGE[caseItem.status]}>{STATUS_LABEL[caseItem.status]}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <WhatsAppLink phone={caseItem.whatsapp} />
          {caseItem.email && <span>{caseItem.email}</span>}
          {(caseItem.patient_age || caseItem.city) && (
            <span>{caseItem.patient_age ? `${caseItem.patient_age} anos` : ""}{caseItem.city ? ` · ${caseItem.city}` : ""}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-muted-foreground">
            Via: <span className="font-medium text-foreground">{PREF_MODALITY_LABEL[caseItem.preferred_modality]}</span>
          </span>
          {caseItem.available_days && (
            <span className="text-muted-foreground">
              Dias: <span className="font-medium text-foreground">{caseItem.available_days}</span>
            </span>
          )}
          {caseItem.available_times && (
            <span className="text-muted-foreground">
              Horario: <span className="font-medium text-foreground">{caseItem.available_times}</span>
            </span>
          )}
        </div>

        {(caseItem.availability || caseItem.observations) && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
            {caseItem.availability && (
              <p><span className="font-medium">Horario especifico:</span> {caseItem.availability}</p>
            )}
            {caseItem.observations && (
              <p><span className="font-medium">Observaciones:</span> {caseItem.observations}</p>
            )}
          </div>
        )}

        {/* Citas */}
        {appointments.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CalendarClock className="size-4 text-accent" /> Citas
              </p>
              {caseOpen && (
                reachedLimit ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    Completados los 3 contactos
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFollowUpOpen(true)}
                    disabled={!hasSeenFirst}
                    title={
                      !hasSeenFirst
                        ? "Marca la cita actual como 'Realizada' para habilitar el siguiente contacto."
                        : undefined
                    }
                  >
                    <CalendarPlus className="size-3.5" /> Agendar próxima cita
                  </Button>
                )
              )}
            </div>
            {appointments.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="tabular-nums">
                  {formatDateTime(a.scheduled_at)} · {MODALITY_LABEL[a.modality]} (contacto {a.contact_number}/3)
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={waLink(caseItem.whatsapp, citaAsignadaMsg(a.scheduled_at))}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir WhatsApp con el mensaje de la cita"
                    className="inline-flex items-center gap-1 rounded-md border border-whatsapp/40 px-2 py-1 text-xs font-medium text-whatsapp transition-colors hover:bg-whatsapp/10"
                  >
                    <WhatsAppIcon className="size-3.5" /> WhatsApp
                  </a>
                  <Select value={a.status} onValueChange={(v) => void setApptStatus(a.id, v as ApptStatus)}>
                    <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["programada", "realizada", "cancelada", "no_asistio"] as ApptStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{APPT_STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Marca una cita como "Realizada" cuando ya atendiste al paciente.
              {!hasSeenFirst && " Tras la primera consulta podrás agendar el seguimiento."}
            </p>
          </div>
        )}

        {profile && (
          <ScheduleFollowUpDialog
            open={followUpOpen}
            caseItem={caseItem}
            professionalId={profile.id}
            myBlocks={myBlocks}
            existingAppointments={appointments}
            onClose={() => setFollowUpOpen(false)}
            onSaved={onChanged}
          />
        )}

        {/* Desasignarme del caso */}
        {!confirmUnassign ? (
          <div className="flex justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmUnassign(true)}
              className="gap-1.5 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
            >
              <UserMinus className="size-3.5" />
              Desasignarme del caso
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-semibold text-foreground">¿Desasignarte de este caso?</p>
                <p className="mt-0.5 text-muted-foreground">
                  El caso <strong>no se borrará</strong>. Se quitará tu asignación y volverá
                  a la lista de casos nuevos sin profesional asignado.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmUnassign(false)} disabled={unassigning}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleUnassign} disabled={unassigning}>
                {unassigning && <Spinner className="text-primary-foreground" />}
                Confirmar
              </Button>
            </div>
          </div>
        )}

        {/* Estado + notas */}
        <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-start">
          <div className="space-y-1.5">
            <Label>Estado del caso</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CaseStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["asignado", "en_contacto", "cerrado", "derivado"] as CaseStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notas del seguimiento</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Registra lo trabajado en el contacto..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {feedback && <span className="text-sm text-muted-foreground">{feedback}</span>}
          <Button onClick={save} disabled={saving}>
            {saving && <Spinner className="text-primary-foreground" />} Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
