import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesion con perfil, redirige al panel.
  useEffect(() => {
    if (session && profile) {
      navigate(
        profile.role === "coordinator" ? "/coordinador" : "/profesional",
        { replace: true }
      );
    }
  }, [session, profile, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) setError(traducirError(error));
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) {
          setError(traducirError(error.message));
        } else {
          setInfo(
            "Cuenta creada. Si tu proyecto requiere confirmacion por correo, revisa tu email; si no, ya puedes iniciar sesion."
          );
          setMode("signin");
        }
      }
    } finally {
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
            {mode === "signin" ? "Acceso del personal" : "Crear cuenta"}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Coordinadores y profesionales voluntarios."
              : "La primera cuenta registrada sera coordinadora; las siguientes seran profesionales (un coordinador puede cambiar el rol)."}
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
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                minLength={6}
                required
              />
            </div>

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
              {mode === "signin" ? "Ingresar" : "Crear cuenta"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
              >
                Crear una cuenta nueva
              </button>
            ) : (
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  setMode("signin");
                  setError(null);
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

function traducirError(msg: string): string {
  if (/invalid login credentials/i.test(msg))
    return "Correo o contrasena incorrectos.";
  if (/email not confirmed/i.test(msg))
    return "Tu correo aun no ha sido confirmado.";
  if (/user already registered/i.test(msg))
    return "Ya existe una cuenta con ese correo.";
  if (/password should be at least/i.test(msg))
    return "La contrasena debe tener al menos 6 caracteres.";
  return msg;
}
