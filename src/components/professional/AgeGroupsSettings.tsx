import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { AgeGroup } from "@/types/database";
import { AGE_GROUP_LABEL } from "@/lib/domain";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const ALL_GROUPS: AgeGroup[] = ["ninos_adolescentes", "adultos", "adultos_mayores"];

function toggle(list: AgeGroup[], g: AgeGroup): AgeGroup[] {
  return list.includes(g) ? list.filter((x) => x !== g) : [...list, g];
}

/** Autoservicio: el profesional indica que grupos de edad atiende. */
export function AgeGroupsSettings() {
  const { profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<AgeGroup[]>(profile?.age_groups ?? []);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setSelected(profile?.age_groups ?? []);
  }, [profile?.age_groups]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setFeedback(null);
    const { error } = await supabase
      .from("profiles")
      .update({ age_groups: selected })
      .eq("id", profile.id);
    setSaving(false);
    if (error) { setFeedback("No se pudo guardar."); return; }
    setFeedback("Guardado.");
    await refreshProfile();
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 p-4">
        <Label>Grupos de edad que atiendo</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_GROUPS.map((g) => {
            const active = selected.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => setSelected((s) => toggle(s, g))}
                className={cn(
                  "flex h-11 items-center justify-center rounded-md border-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-input bg-background text-foreground hover:bg-secondary"
                )}
              >
                {AGE_GROUP_LABEL[g]}
              </button>
            );
          })}
        </div>
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
