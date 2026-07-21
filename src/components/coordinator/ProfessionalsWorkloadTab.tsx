import { useMemo } from "react";
import type { Case, Profile } from "@/types/database";
import { AgeGroupBadges } from "@/components/ui/age-group-badges";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  professionals: Profile[];
  cases: Case[];
}

/** Lista simple de cuantos casos activos lleva cada profesional, para ver de un vistazo quien esta sobrecargado. */
export function ProfessionalsWorkloadTab({ professionals, cases }: Props) {
  const rows = useMemo(() => {
    return professionals
      .map((p) => {
        const active = cases.filter(
          (c) => c.assigned_professional_id === p.id && c.status !== "cerrado" && c.status !== "derivado"
        ).length;
        const atLimit = p.max_active_cases != null && active >= p.max_active_cases;
        return { professional: p, active, atLimit };
      })
      .sort((a, b) => b.active - a.active || a.professional.full_name.localeCompare(b.professional.full_name));
  }, [professionals, cases]);

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No hay profesionales registrados.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Profesional</th>
              <th className="px-4 py-3 font-medium">Carga actual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ professional: p, active, atLimit }) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{p.full_name || "(sin nombre)"}</div>
                  <AgeGroupBadges groups={p.age_groups} className="mt-0.5" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        atLimit
                          ? "border-warning/40 bg-warning/15 text-warning-foreground"
                          : "border-border bg-secondary text-secondary-foreground"
                      )}
                    >
                      {active} {p.max_active_cases != null ? `/ ${p.max_active_cases}` : "· sin límite"}
                    </Badge>
                    {atLimit && (
                      <span className="text-xs font-medium text-warning-foreground">Al límite</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
