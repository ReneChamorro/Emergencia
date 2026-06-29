import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Appointment, ApptStatus, Case, CaseStatus } from "@/types/database";
import {
  APPT_STATUS_LABEL,
  MODALITY_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  URGENCY_BADGE,
  URGENCY_LABEL,
  URGENCY_ORDER,
  formatDateTime,
} from "@/lib/domain";
import { StaffLayout } from "@/components/StaffLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FullPageSpinner, Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CalendarClock, Phone } from "lucide-react";

export default function Profesional() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [caseRes, apptRes] = await Promise.all([
      supabase.from("cases").select("*").order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*")
        .order("scheduled_at", { ascending: true }),
    ]);
    const list = ((caseRes.data as Case[]) ?? []).sort(
      (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
    );
    setCases(list);
    setAppointments((apptRes.data as Appointment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <FullPageSpinner label="Cargando tus casos..." />;

  const activeCases = cases.filter(
    (c) => c.status !== "cerrado" && c.status !== "derivado"
  );

  return (
    <StaffLayout
      title={`Hola${profile?.full_name ? ", " + profile.full_name.split(" ")[0] : ""}`}
      subtitle="Estos son los casos asignados a ti. Atencion focalizada: 1 a 3 contactos."
    >
      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aun no tienes casos asignados. El equipo coordinador te asignara
            pacientes pronto.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeCases.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No tienes casos activos. Mostrando historial.
            </p>
          )}
          {cases.map((c) => (
            <ProfessionalCaseCard
              key={c.id}
              caseItem={c}
              appointments={appointments.filter((a) => a.case_id === c.id)}
              onChanged={() => void load()}
            />
          ))}
        </div>
      )}
    </StaffLayout>
  );
}

function ProfessionalCaseCard({
  caseItem,
  appointments,
  onChanged,
}: {
  caseItem: Case;
  appointments: Appointment[];
  onChanged: () => void;
}) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<CaseStatus>(caseItem.status);
  const [notes, setNotes] = useState(caseItem.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const highRisk = caseItem.in_danger || caseItem.self_harm_ideation;

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
        detail: `Estado actualizado a ${STATUS_LABEL[status]}`,
        created_by: profile.id,
      });
    }
    setSaving(false);
    setFeedback(error ? "No se pudo guardar." : "Guardado.");
    if (!error) onChanged();
  }

  async function setApptStatus(id: string, newStatus: ApptStatus) {
    await supabase.from("appointments").update({ status: newStatus }).eq("id", id);
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {highRisk && (
              <AlertTriangle
                className="size-5 text-destructive"
                aria-label="Riesgo alto"
              />
            )}
            {caseItem.patient_name}
          </CardTitle>
          <div className="flex gap-2">
            <Badge className={URGENCY_BADGE[caseItem.urgency]}>
              {URGENCY_LABEL[caseItem.urgency]}
            </Badge>
            <Badge className={STATUS_BADGE[caseItem.status]}>
              {STATUS_LABEL[caseItem.status]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <a
            href={`https://wa.me/${caseItem.whatsapp.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
          >
            <Phone className="size-4" /> {caseItem.whatsapp}
          </a>
          <span>
            {caseItem.patient_age ?? "—"} anos · {caseItem.city ?? "—"}
          </span>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Motivo
          </p>
          <p className="text-sm text-foreground">{caseItem.main_reason}</p>
        </div>

        {caseItem.availability && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Disponibilidad:</span>{" "}
            {caseItem.availability}
          </p>
        )}

        {/* Citas */}
        {appointments.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <CalendarClock className="size-4 text-accent" /> Citas
            </p>
            {appointments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="tabular-nums">
                  {formatDateTime(a.scheduled_at)} · {MODALITY_LABEL[a.modality]}{" "}
                  (contacto {a.contact_number}/3)
                </span>
                <Select
                  value={a.status}
                  onValueChange={(v) => void setApptStatus(a.id, v as ApptStatus)}
                >
                  <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "programada",
                        "realizada",
                        "cancelada",
                        "no_asistio",
                      ] as ApptStatus[]
                    ).map((s) => (
                      <SelectItem key={s} value={s}>
                        {APPT_STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {/* Estado + notas */}
        <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-start">
          <div className="space-y-1.5">
            <Label>Estado del caso</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as CaseStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  ["asignado", "en_contacto", "cerrado", "derivado"] as CaseStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
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
          {feedback && (
            <span className="text-sm text-muted-foreground">{feedback}</span>
          )}
          <Button onClick={save} disabled={saving}>
            {saving && <Spinner className="text-primary-foreground" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
