import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Fila compacta para una tarjeta de ajuste ya respondida, con boton para volver a editarla. */
export function CollapsedSummaryRow({
  label,
  summary,
  onEdit,
}: {
  label: string;
  summary: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-sm text-muted-foreground">{summary}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0 gap-1.5">
        <Pencil className="size-3.5" /> Editar
      </Button>
    </div>
  );
}
