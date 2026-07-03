import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, HeartPulse, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { intakeSchema, LIMITS } from "@/lib/validation";
import type { CaseIntakeInput, PrefModality, StableConn } from "@/types/database";
import { PREF_MODALITY_LABEL, STABLE_CONN_LABEL } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo", "Cualquier dia"];
const TIMES = ["Manana", "Mediodia", "Tarde", "Noche", "Cualquier horario"];
const STEPS = ["Tus datos", "Modalidad", "Disponibilidad", "Confirmar"];

interface FormState {
  patient_name: string;
  patient_age: string;
  city: string;
  whatsapp: string;
  email: string;
  preferred_modality: PrefModality | "";
  has_stable_conn: StableConn | "";
  available_days: string[];
  available_times: string[];
  availability: string;
  observations: string;
  consent: boolean;
}

const EMPTY: FormState = {
  patient_name: "",
  patient_age: "",
  city: "",
  whatsapp: "",
  email: "",
  preferred_modality: "",
  has_stable_conn: "",
  available_days: [],
  available_times: [],
  availability: "",
  observations: "",
  consent: false,
};

function toggleItem(arr: string[], item: string): string[] {
  if (item === "Cualquier dia" || item === "Cualquier horario") return [item];
  const filtered = arr.filter((d) => d !== "Cualquier dia" && d !== "Cualquier horario");
  return filtered.includes(item)
    ? filtered.filter((d) => d !== item)
    : [...filtered, item];
}

export default function Intake() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.patient_name.trim()) return "Por favor indica tu nombre.";
      if (!form.whatsapp.trim()) return "Necesitamos un numero de WhatsApp para contactarte.";
    }
    if (s === 1) {
      if (!form.preferred_modality) return "Selecciona la via de atencion que prefieres.";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setError(null);
    if (!form.consent) {
      setError("Debes autorizar el contacto para continuar.");
      return;
    }
    if (!isSupabaseConfigured) {
      setError("La aplicacion aun no esta conectada a la base de datos. Avisa al equipo coordinador.");
      return;
    }

    const parsed = intakeSchema.safeParse({
      patient_name: form.patient_name,
      patient_age: form.patient_age,
      city: form.city,
      whatsapp: form.whatsapp,
      email: form.email,
      preferred_modality: form.preferred_modality || "cualquiera",
      has_stable_conn: form.has_stable_conn || null,
      available_days: form.available_days.join(", "),
      available_times: form.available_times.join(", "),
      availability: form.availability,
      observations: form.observations,
      consent: form.consent,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos del formulario.");
      return;
    }

    setSubmitting(true);
    const d = parsed.data;

    // Anti-duplicados: ya existe un caso activo con el mismo nombre + teléfono?
    const { data: exists, error: existsError } = await supabase.rpc("case_exists", {
      p_name: d.patient_name,
      p_whatsapp: d.whatsapp,
    });
    if (!existsError && exists === true) {
      setSubmitting(false);
      setError(
        "Tu solicitud ya está en el sistema. Serás contactado cuando se asigne tu cita. No necesitas enviar el formulario otra vez."
      );
      return;
    }

    const payload: CaseIntakeInput = {
      patient_name: d.patient_name,
      patient_age: d.patient_age,
      city: d.city,
      whatsapp: d.whatsapp,
      email: d.email,
      preferred_modality: d.preferred_modality,
      has_stable_conn: d.has_stable_conn ?? null,
      available_days: d.available_days,
      available_times: d.available_times,
      availability: d.availability,
      observations: d.observations,
      consent: true,
    };

    const { error: insertError } = await supabase.from("cases").insert(payload);
    setSubmitting(false);
    if (insertError) {
      if (insertError.code === "23505" || /duplicate key|cases_active_person_uniq/i.test(insertError.message)) {
        setError("Tu solicitud ya está en el sistema. Serás contactado cuando se asigne tu cita.");
      } else if (insertError.message.includes("Demasiadas solicitudes")) {
        setError("Ya tienes varias solicitudes recientes. El equipo coordinador te contactara pronto.");
      } else {
        setError("No pudimos registrar tu solicitud. Intenta de nuevo o contacta al equipo.");
      }
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <Shell>
        <Card className="animate-fade-in">
          <CardContent className="space-y-5 p-8 text-center">
            <CheckCircle2 className="mx-auto size-14 text-success" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Solicitud registrada</h2>
            <div className="space-y-2 text-sm text-muted-foreground text-left rounded-md border border-border bg-muted/30 p-4">
              <p className="font-medium text-foreground">Gracias por completar tus datos.</p>
              <p>
                El equipo coordinador revisara tu disponibilidad y te contactara para confirmar
                el dia, la hora y el profesional asignado.
              </p>
              <p>Esta atencion forma parte de una iniciativa humanitaria y <strong>sin costo</strong>.</p>
            </div>
            <Button
              variant="outline"
              onClick={() => { setForm(EMPTY); setStep(0); setDone(false); }}
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
            <div className={"h-1.5 rounded-full transition-colors " + (i <= step ? "bg-accent" : "bg-border")} />
            <span className={"text-xs " + (i === step ? "font-medium text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </li>
        ))}
      </ol>

      <Card className="animate-fade-in">
        <CardContent className="space-y-5 p-6">

          {/* Paso 1: Datos */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre y apellido *</Label>
                <Input
                  id="name"
                  value={form.patient_name}
                  onChange={(e) => update("patient_name", e.target.value)}
                  autoComplete="name"
                  maxLength={LIMITS.name}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">Numero de WhatsApp *</Label>
                <Input
                  id="whatsapp"
                  type="tel"
                  inputMode="tel"
                  placeholder="+58 412 1234567"
                  value={form.whatsapp}
                  onChange={(e) => update("whatsapp", e.target.value)}
                  autoComplete="tel"
                  maxLength={LIMITS.whatsapp}
                />
                <p className="text-xs text-muted-foreground">El equipo te contactara por aqui.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electronico (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  autoComplete="email"
                  maxLength={LIMITS.email}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="age">Edad (opcional)</Label>
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
                  <Label htmlFor="city">Ciudad / estado (opcional)</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    autoComplete="address-level2"
                    maxLength={LIMITS.city}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Paso 2: Modalidad */}
          {step === 1 && (
            <div className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="text-base font-medium text-foreground">
                  Por que via puedes recibir la atencion? *
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(["videollamada", "llamada", "whatsapp_audio", "cualquiera"] as PrefModality[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update("preferred_modality", m)}
                      className={cn(
                        "flex h-12 items-center justify-center rounded-md border-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        form.preferred_modality === m
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-input bg-background text-foreground hover:bg-secondary"
                      )}
                    >
                      {PREF_MODALITY_LABEL[m]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-base font-medium text-foreground">
                  Tienes conexion estable para una videollamada?
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["si", "no", "a_veces"] as StableConn[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update("has_stable_conn", v)}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-md border-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        form.has_stable_conn === v
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-input bg-background text-foreground hover:bg-secondary"
                      )}
                    >
                      {STABLE_CONN_LABEL[v]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {/* Paso 3: Disponibilidad */}
          {step === 2 && (
            <div className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="text-base font-medium text-foreground">
                  Que dias tienes disponibilidad?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const selected = form.available_days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => update("available_days", toggleItem(form.available_days, day))}
                        className={cn(
                          "rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-input bg-background text-foreground hover:bg-secondary"
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-base font-medium text-foreground">
                  En que horario podrias ser atendido/a?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TIMES.map((t) => {
                    const selected = form.available_times.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => update("available_times", toggleItem(form.available_times, t))}
                        className={cn(
                          "rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-input bg-background text-foreground hover:bg-secondary"
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="availability">Horarios especificos disponibles (opcional)</Label>
                <Input
                  id="availability"
                  value={form.availability}
                  onChange={(e) => update("availability", e.target.value)}
                  placeholder='Ej: "lunes despues de las 3pm", "cualquier dia despues de las 6pm"'
                  maxLength={LIMITS.availability}
                />
              </div>
            </div>
          )}

          {/* Paso 4: Confirmar */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-1">
                <p className="font-medium text-foreground mb-2">Resumen de tu solicitud</p>
                <Row label="Nombre" value={form.patient_name} />
                <Row label="WhatsApp" value={form.whatsapp} />
                {form.email && <Row label="Correo" value={form.email} />}
                {form.city && <Row label="Ciudad" value={form.city} />}
                <Row
                  label="Via de atencion"
                  value={form.preferred_modality ? PREF_MODALITY_LABEL[form.preferred_modality as PrefModality] : "—"}
                />
                {form.available_days.length > 0 && (
                  <Row label="Dias disponibles" value={form.available_days.join(", ")} />
                )}
                {form.available_times.length > 0 && (
                  <Row label="Horarios" value={form.available_times.join(", ")} />
                )}
                {form.availability && <Row label="Detalle horario" value={form.availability} />}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="observations">Observaciones para la agenda (opcional)</Label>
                <Textarea
                  id="observations"
                  value={form.observations}
                  onChange={(e) => update("observations", e.target.value)}
                  placeholder='Ej: "solo puedo por llamada", "no tengo privacidad en casa", "prefiero horario nocturno"'
                  className="min-h-[88px]"
                  maxLength={LIMITS.observations}
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => update("consent", e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--accent))]"
                />
                <span className="text-sm text-foreground">
                  Autorizo al equipo coordinador a contactarme para confirmar mi cita y confirmo
                  que esta atencion corresponde al Programa Humanitario de Atencion Psicologica.
                </span>
              </label>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            {step > 0 ? (
              <Button variant="outline" onClick={back} disabled={submitting}>
                <ChevronLeft className="size-4" /> Atras
              </Button>
            ) : <span />}

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
          <Link to="/login" className="text-sm text-primary-foreground/80 hover:text-primary-foreground hover:underline">
            Soy del equipo
          </Link>
        </div>
      </header>
      <main className="container max-w-2xl py-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-accent mb-1">
            Programa Humanitario · Sin costo
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Solicitud de cita – Atencion psicologica humanitaria
          </h1>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
            Completa este formulario para que el equipo coordinador te asigne un horario
            con un profesional voluntario.
          </p>
          <p className="mx-auto mt-2 max-w-prose rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-muted-foreground">
            La cantidad de citas (hasta 3 contactos) la definirá el equipo profesional según tu
            caso. Con enviar el formulario <strong>una sola vez</strong> es suficiente.
          </p>
        </div>
        {children}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}:</span>
      <span className="text-foreground">{value || "—"}</span>
    </div>
  );
}
