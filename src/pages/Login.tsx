import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function Login() {
  const { session, profile, signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  // Si ya hay sesion con perfil, redirige al panel.
  useEffect(() => {
    if (session && profile) {
      navigate(
        profile.role === "professional" ? "/profesional" : "/coordinador",
        { replace: true }
      );
    }
  }, [session, profile, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) setError(traducirError(error));
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/restablecer-contrasena`,
        });
        if (error) {
          setError(traducirError(error.message, error.status));
        } else {
          setInfo(
            "Si el correo esta registrado, te enviamos un enlace para restablecer la contrasena. Revisa tu bandeja de entrada (o spam)."
          );
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) {
          setError(traducirError(error.message, error.status));
        } else {
          setInfo(
            "Cuenta creada. Si tu proyecto requiere confirmacion por correo, revisa tu email; si no, ya puedes iniciar sesion."
          );
          setMode("signin");
        }
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-primary px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5 text-primary-foreground">
        <HeartPulse className="size-7 text-accent" aria-hidden="true" />
        <span className="text-lg font-semibold">
          Apoyo Psicologico de Emergencia
        </span>
      </div>

      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <CardTitle>
            {mode === "signin"
              ? "Acceso del personal"
              : mode === "forgot"
                ? "Recuperar contrasena"
                : "Crear cuenta"}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Coordinadores y profesionales voluntarios."
              : mode === "forgot"
                ? "Escribe tu correo y te enviaremos un enlace para restablecer tu contrasena."
                : "Las cuentas nuevas se crean como profesionales. Un coordinador (o el administrador de la base de datos) asigna el rol de coordinacion."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured && (
            <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
              Supabase no esta configurado. Copia <code>.env.example</code> a{" "}
              <code>.env.local</code> y completa las credenciales.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input
                  id="fullName"
                  name="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Contrasena</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  minLength={6}
                  required
                />
              </div>
            )}
            {mode === "signin" && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:underline"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setInfo(null);
                  }}
                >
                  ¿Olvidaste tu contrasena?
                </button>
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
            {info && (
              <p
                role="status"
                className="rounded-md border border-success/30 bg-success/10 p-2.5 text-sm text-success"
              >
                {info}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Spinner className="text-primary-foreground" />}
              {mode === "signin"
                ? "Ingresar"
                : mode === "forgot"
                  ? "Enviar enlace"
                  : "Crear cuenta"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" && (
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
              >
                Crear una cuenta nueva
              </button>
            )}
            {(mode === "signup" || mode === "forgot") && (
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
              >
                Ya tengo cuenta, iniciar sesion
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Link
        to="/"
        className="mt-6 text-sm text-primary-foreground/80 hover:text-primary-foreground hover:underline"
      >
        ← Volver al formulario de solicitud de ayuda
      </Link>
    </div>
  );
}

function traducirError(msg: string, status?: number): string {
  if (/invalid login credentials/i.test(msg))
    return "Correo o contrasena incorrectos.";
  if (/email not confirmed/i.test(msg))
    return "Tu correo aun no ha sido confirmado. Revisa tu bandeja de entrada (o spam).";
  if (/user already registered/i.test(msg))
    return "Ya existe una cuenta con ese correo. Inicia sesion en su lugar.";
  if (/password should be at least/i.test(msg))
    return "La contrasena debe tener al menos 6 caracteres.";
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(msg))
    return "Se enviaron demasiados intentos en poco tiempo. Espera unos minutos y vuelve a intentarlo.";
  if ((status && status >= 500) || !msg || msg.trim() === "{}")
    return "Ocurrio un error en el servidor al procesar la solicitud. Intenta de nuevo en unos minutos.";
  return msg;
}
