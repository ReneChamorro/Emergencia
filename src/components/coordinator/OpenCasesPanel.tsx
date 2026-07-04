import { useState } from "react";
import { CalendarDays, Clock, ChevronDown, ChevronUp, Inbox, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { URGENCY_BADGE, URGENCY_LABEL } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { Case } from "@/types/database";

interface Props {
  cases: Case[];
  loading: boolean;
  selectedCaseId: string | null;
  onSelect: (caseId: string | null) => void;
  error?: string | null;
}

export function OpenCasesPanel({ cases, loading, selectedCaseId, onSelect, error }: Props) {
  const [expanded, setExpanded] = useState(true);
  const selectedCase = cases.find((c) => c.id === selectedCaseId) ?? null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Inbox className="size-4 text-accent" aria-hidden="true" />
          Casos abiertos por asignar
          <Badge className="border-accent/30 bg-accent/10 text-accent">{cases.length}</Badge>
        </span>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border p-3">
          {selectedCase && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
              <span className="text-foreground">
                Asignando a <strong>{selectedCase.patient_name}</strong> — haz clic en un
                horario disponible del calendario para colocarlo ahí.
              </span>
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-accent hover:underline"
              >
                <X className="size-3.5" /> Cancelar
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Spinner className="size-4" /> Cargando...
            </div>
          ) : cases.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No hay casos nuevos por asignar en este momento.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {cases.map((c) => {
                const selected = c.id === selectedCaseId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(selected ? null : c.id)}
                    aria-pressed={selected}
                    title={
                      [c.available_days, c.available_times, c.availability]
                        .filter(Boolean)
                        .join(" · ") || undefined
                    }
                    className={cn(
                      "flex min-h-[52px] w-[210px] shrink-0 flex-col items-start justify-center gap-1 rounded-lg border-2 px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background hover:bg-secondary/60"
                    )}
                  >
                    <span className="w-full truncate text-sm font-medium text-foreground">
                      {c.patient_name}
                    </span>
                    <Badge className={URGENCY_BADGE[c.urgency]}>{URGENCY_LABEL[c.urgency]}</Badge>
                    {c.available_days && (
                      <span className="flex w-full items-center gap-1 truncate text-xs text-muted-foreground">
                        <CalendarDays className="size-3 shrink-0" aria-hidden="true" />
                        {c.available_days}
                      </span>
                    )}
                    {c.available_times && (
                      <span className="flex w-full items-center gap-1 truncate text-xs text-muted-foreground">
                        <Clock className="size-3 shrink-0" aria-hidden="true" />
                        {c.available_times}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
