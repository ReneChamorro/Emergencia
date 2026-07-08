import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AGE_GROUP_BADGE, AGE_GROUP_LABEL, AGE_GROUP_SHORT_LABEL } from "@/lib/domain";
import type { AgeGroup } from "@/types/database";

interface Props {
  groups: AgeGroup[] | null | undefined;
  /** Etiquetas abreviadas (para espacios angostos como los Select de médico). */
  short?: boolean;
  className?: string;
}

/** Badges de color mostrando los grupos de edad que atiende un profesional. */
export function AgeGroupBadges({ groups, short, className }: Props) {
  if (!groups || groups.length === 0) return null;
  const labelMap = short ? AGE_GROUP_SHORT_LABEL : AGE_GROUP_LABEL;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {groups.map((g) => (
        <Badge key={g} className={cn("px-1.5 py-0 text-[10px] font-medium", AGE_GROUP_BADGE[g])}>
          {labelMap[g]}
        </Badge>
      ))}
    </span>
  );
}
