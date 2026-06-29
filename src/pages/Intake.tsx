import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, HeartPulse, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { suggestUrgency, isHighRisk } from "@/lib/domain";
import type { CaseIntakeInput } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CrisisBanner } from "@/components/CrisisBanner";
import { YesNoField } from "@/components/YesNoField";

interface FormState {
  patient_name: string;
  patient_age: string;
  city: string;
  whatsapp: string;
  main_reason: string;
  availability: string;
  in_danger: boolean | null;
  self_harm_ideation: boolean | null;
  is_alone: boolean | null;
  lost_family_home: boolean | null;
  consent: boolean;
}

const EMPTY: FormState = {
  patient_name: "",
  patient_age: "",
  city: "",
  whatsapp: "",
  main_reason: "",
  availability: "",
  in_danger: null,
  self_harm_ideation: null,
  is_alone: null,
  lost_family_home: null,
  consent: false,
};

const STEPS = ["Tus datos", "Tu situacion", "Unas preguntas", "Confirmar"];

export default function Intake() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const triageAnswered =
    form.in_danger !== null &&
    form.self_harm_ideation !== null &&
    form.is_alone !== null &&
    form.lost_family_home !== null;

  const highRisk = useMemo(
    () =>
      isHighRisk({
        in_danger: form.in_danger === true,
        self_harm_ideation: form.self_harm_ideation === true,
        is_alone: form.is_alone === true,
        lost_family_home: form.lost_family_home === true,
      }),
    [form.in_danger, form.self_harm_ideation, form.is_alone, form.lost_family_home]
  );

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.patient_name.trim()) return "Por favor indica tu nombre.";
      if (!form.whatsapp.trim())
        return "Necesitamos un numero de WhatsApp para contactarte.";
    }
    if (s === 1) {
      if (!form.main_reason.trim())
        return "Cuentanos brevemente en que necesitas apoyo.";
    }
    if (s === 2 && !triageAnswered) {
      return "Por favor responde las cuatro preguntas.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setError(null);
    if (!form.consent) {
      setError("Debes aceptar el consentimiento para continuar.");
      return;
    }
    if (!isSupabaseConfigured) {
      setError(
        "La aplicacion aun no esta conectada a la base de datos. Avisa al equipo coordinador."
      );
      return;
    }
    setSubmitting(true);
    const payload: CaseIntakeInput = {
      patient_name: form.patient_name.trim(),
      patient_age: form.patient_age ? Number(form.patient_age) : null,
      city: form.city.trim() || null,
      whatsapp: form.whatsapp.trim(),
      main_reason: form.main_reason.trim(),
      availability: form.availability.trim() || null,
      in_danger: form.in_danger === true,
      self_harm_ideation: form.self_harm_ideation === true,
      is_alone: form.is_alone === true,
      lost_family_home: form.lost_family_home === true,
      urgency: suggestUrgency({
        in_danger: form.in_danger === true,
        self_harm_ideation: form.self_harm_ideation === true,
        is_alone: form.is_alone === true,
        lost_family_home: form.lost_family_home === true,
      }),
      consent: true,
    };

    const { error: insertError } = await supabase.from("cases").insert(payload);
    setSubmitting(false);
    if (insertError) {
      setError(
        "No pudimos registrar tu solicitud. Intenta de nuevo o contacta al equipo."
      );
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <Shell>
        <Card className="animate-fade-in">
          <CardContent className="space-y-4 p-8 text-center">
            <CheckCircle2
              className="mx-auto size-14 text-success"
              aria-hidden="true"
            />
            <h2 className="text-xl font-bold text-foreground">
              Tu solicitud quedo registrada
            </h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Un profesional voluntario revisara tu caso y te contactara por
                WhatsApp al numero que indicaste. La atencion se prioriza segun la
                urgencia.
              </p>
              <p>
                Recuerda: este es un apoyo psicologico focalizado en crisis (1 a 3
                contactos iniciales), no terapia indefinida.
              </p>
            </div>
            {highRisk && <CrisisBanner />}
            <Button
              variant="outline"
              onClick={() => {
                setForm(EMPTY);
                setStep(0);
                setDone(false);
              }}
            >
              Registrar otra solicitud
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Indicador de pasos */}
      <ol className="mb-5 flex items-center gap-2" aria-label="Progreso">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1">
            <div
              className={
                "h-1.5 rounded-full transition-colors " +
                (i <= step ? "bg-accent" : "bg-border")
              }
            />
            <span
              className={
                "text-xs " +
                (i === step
                  ? "font-medium text-foreground"
                  : "text-muted-foreground")
              }
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <Card className="animate-fade-in">
        <CardContent className="space-y-5 p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre y apellido *</Label>
                <Input
                  id="name"
                  value={form.patient_name}
                  onChange={(e) => update("patient_name", e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="age">Edad</Label>
                  <Input
                    id="age"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    value={form.patient_age}
                    onChange={(e) => update("patient_age", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    autoComplete="address-level2"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  inputMode="tel"
                  placeholder="Ej: +58 412 1234567"
                  value={form.whatsapp}
                  onChange={(e) => update("whatsapp", e.target.value)}
                  autoComplete="tel"
                />
                <p className="text-xs text-muted-foreground">
                  Por aqui te contactara el profesional.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reason">
                  En que necesitas apoyo? Cuentanos brevemente *
                </Label>
                <Textarea
                  id="reason"
                  value={form.main_reason}
                  onChange={(e) => update("main_reason", e.target.value)}
                  placeholder="Puedes escribir lo que sientes o lo que esta pasando."
                  className="min-h-[120px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="availability">
                  En que horarios podrias recibir una llamada?
                </Label>
                <Input
                  id="availability"
                  value={form.availability}
                  onChange={(e) => update("availability", e.target.value)}
                  placeholder="Ej: tardes despues de las 3pm, fines de semana..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Estas preguntas nos ayudan a dar prioridad a quien mas lo necesita.
                No hay respuestas correctas o incorrectas.
              </p>
              <YesNoField
                legend="Estas en peligro en este momento?"
                value={form.in_danger}
                onChange={(v) => update("in_danger", v)}
                dangerOnYes
              />
              <YesNoField
                legend="Has tenido ideas de hacerte dano?"
                value={form.self_harm_ideation}
                onChange={(v) => update("self_harm_ideation", v)}
                dangerOnYes
              />
              <YesNoField
                legend="Te encuentras solo o sola ahora?"
                value={form.is_alone}
                onChange={(v) => update("is_alone", v)}
              />
              <YesNoField
                legend="Perdiste un familiar, tu vivienda o tu seguridad basica?"
                value={form.lost_family_home}
                onChange={(v) => update("lost_family_home", v)}
              />
              {highRisk && <CrisisBanner />}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <p className="font-medium text-foreground">Resumen</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Nombre:</strong>{" "}
                    {form.patient_name || "—"}
                  </li>
                  <li>
                    <strong className="text-foreground">WhatsApp:</strong>{" "}
                    {form.whatsapp || "—"}
                  </li>
                  <li>
                    <strong className="text-foreground">Motivo:</strong>{" "}
                    {form.main_reason || "—"}
                  </li>
                </ul>
              </div>

              {highRisk && <CrisisBanner />}

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => update("consent", e.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-[hsl(var(--accent))]"
                />
                <span className="text-sm text-foreground">
                  Doy mi consentimiento para ser contactado/a por un profesional
                  voluntario y para que mis datos se usen unicamente con el fin de
                  coordinar esta atencion. Entiendo que es un apoyo focalizado en
                  crisis, no terapia indefinida.
                </span>
              </label>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            {step > 0 ? (
              <Button variant="outline" onClick={back} disabled={submitting}>
                <ChevronLeft className="size-4" /> Atras
              </Button>
            ) : (
              <span />
            )}

            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continuar <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting || !form.consent}>
                {submitting && <Spinner className="text-primary-foreground" />}
                Enviar solicitud
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HeartPulse className="size-6 text-accent" aria-hidden="true" />
            <span className="font-semibold">Apoyo Psicologico de Emergencia</span>
          </div>
          <Link
            to="/login"
            className="text-sm text-primary-foreground/80 hover:text-primary-foreground hover:underline"
          >
            Soy del equipo
          </Link>
        </div>
      </header>

      <main className="container max-w-2xl py-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Solicita apoyo psicologico
          </h1>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
            Estamos aqui para acompanarte. Completa este formulario breve y un
            profesional voluntario se pondra en contacto contigo.
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}
