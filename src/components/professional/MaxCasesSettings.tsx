import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Autoservicio: el profesional fija cuantas consultas activas acepta a la vez. */
export function MaxCasesSettings() {
  const { profile, refreshProfile } = useAuth();
  const [value, setValue] = useState(profile?.max_active_cases?.toString() ?? "");
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setValue(profile?.max_active_cases?.toString() ?? "");
  }, [profile?.max_active_cases]);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("assigned_professional_id", profile.id)
      .not("status", "in", "(cerrado,derivado)")
      .then(({ count }) => setActiveCount(count ?? 0));
  }, [profile?.id]);

  async function save() {
    if (!profile) return;
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed <= 0)) {
      setFeedback("Debe ser un numero entero mayor a 0 (o vacio para sin limite).");
      return;
    }
    setSaving(true);
    setFeedback(null);
    const { error } = await supabase
      .from("profiles")
      .update({ max_active_cases: parsed })
      .eq("id", profile.id);
    setSaving(false);
    if (error) { setFeedback("No se pudo guardar."); return; }
    setFeedback("Guardado.");
    await refreshProfile();
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 p-4">
        <Label htmlFor="maxCases">Maximo de consultas activas que puedo llevar a la vez</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            id="maxCases"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Sin limite"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-32"
          />
          {activeCount !== null && (
            <span className="text-sm text-muted-foreground">
              Tienes <strong className="text-foreground">{activeCount}</strong> consulta{activeCount !== 1 ? "s" : ""} activa{activeCount !== 1 ? "s" : ""} ahora mismo.
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Si ya tienes mas casos activos que el limite que pongas, esos se quedan como estan; solo se
          bloquean las asignaciones nuevas mientras estes en el limite o por encima.
        </p>
        <div className="flex items-center justify-end gap-3">
          {feedback && <span className="text-sm text-muted-foreground">{feedback}</span>}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Spinner className="text-primary-foreground" />} Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
