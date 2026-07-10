import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
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

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  // Supabase detecta el token de recuperacion en la URL y crea una sesion
  // temporal; esperamos ese evento antes de permitir cambiar la contrasena.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setError(null);
    if (password.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        setDone(true);
        setTimeout(() => navigate("/login", { replace: true }), 2000);
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
          <CardTitle>Nueva contrasena</CardTitle>
          <CardDescription>
            Elige una nueva contrasena para tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <p
              role="status"
              className="rounded-md border border-success/30 bg-success/10 p-2.5 text-sm text-success"
            >
              Contrasena actualizada. Redirigiendo al inicio de sesion...
            </p>
          ) : !ready ? (
            <p className="text-sm text-muted-foreground">
              Verificando el enlace de recuperacion...
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="password">Nueva contrasena</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
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

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Spinner className="text-primary-foreground" />}
                Guardar contrasena
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Link
        to="/login"
        className="mt-6 text-sm text-primary-foreground/80 hover:text-primary-foreground hover:underline"
      >
        ← Volver al inicio de sesion
      </Link>
    </div>
  );
}
