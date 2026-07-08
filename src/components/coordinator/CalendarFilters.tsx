import { useState } from "react";
import type { ApptStatus, Profile, Urgency } from "@/types/database";
import { APPT_STATUS_LABEL, URGENCY_LABEL } from "@/lib/domain";
import { TIME_OF_DAY_LABEL, type TimeOfDay } from "@/lib/calendarUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AgeGroupBadges } from "@/components/ui/age-group-badges";
import { CalendarRange, ChevronDown, ChevronUp, FilterX, SlidersHorizontal } from "lucide-react";

export interface CalendarFilterState {
  professionalId: string; // "todos" | profile.id
  franja: TimeOfDay | "todas";
  apptStatus: ApptStatus | "todas";
  urgency: Urgency | "todas";
  from: string; // "YYYY-MM-DD" | ""
  to: string; // "YYYY-MM-DD" | ""
}

export const EMPTY_FILTERS: CalendarFilterState = {
  professionalId: "todos",
  franja: "todas",
  apptStatus: "todas",
  urgency: "todas",
  from: "",
  to: "",
};

export function isRangeActive(f: CalendarFilterState): boolean {
  return Boolean(f.from && f.to);
}

export function hasActiveFilters(f: CalendarFilterState): boolean {
  return countActiveFilters(f) > 0;
}

export function countActiveFilters(f: CalendarFilterState): number {
  let n = 0;
  if (f.professionalId !== "todos") n++;
  if (f.franja !== "todas") n++;
  if (f.apptStatus !== "todas") n++;
  if (f.urgency !== "todas") n++;
  if (f.from || f.to) n++;
  return n;
}

interface Props {
  professionals: Profile[];
  value: CalendarFilterState;
  onChange: (next: CalendarFilterState) => void;
  onGoToDate: (dateStr: string) => void;
}

export function CalendarFilters({ professionals, value, onChange, onGoToDate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = countActiveFilters(value);

  const set = <K extends keyof CalendarFilterState>(key: K, v: CalendarFilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="mb-4 rounded-lg border border-border bg-card shadow-sm">
      <div className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex min-h-11 flex-1 items-center gap-2 rounded text-left text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
          Filtros
          {activeCount > 0 && (
            <Badge className="border-accent/30 bg-accent/10 text-accent">{activeCount}</Badge>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {activeCount > 0 && !expanded && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="inline-flex min-h-11 items-center gap-1 rounded px-2 text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FilterX className="size-3.5" /> Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? "Contraer filtros" : "Expandir filtros"}
            className="flex size-11 shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? (
              <ChevronUp className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Medico */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Médico</Label>
              <Select value={value.professionalId} onValueChange={(v) => set("professionalId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los médicos</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="inline-flex items-center gap-1.5">
                        {p.full_name || "(sin nombre)"}
                        <AgeGroupBadges groups={p.age_groups} short />
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Franja horaria */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Franja horaria</Label>
              <Select value={value.franja} onValueChange={(v) => set("franja", v as CalendarFilterState["franja"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todo el día</SelectItem>
                  {(["manana", "tarde", "noche"] as TimeOfDay[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIME_OF_DAY_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado de cita */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado de la cita</Label>
              <Select value={value.apptStatus} onValueChange={(v) => set("apptStatus", v as CalendarFilterState["apptStatus"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos los estados</SelectItem>
                  {(["programada", "realizada", "cancelada", "no_asistio"] as ApptStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{APPT_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Urgencia */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Urgencia</Label>
              <Select value={value.urgency} onValueChange={(v) => set("urgency", v as CalendarFilterState["urgency"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Toda urgencia</SelectItem>
                  {(["alta", "media", "baja"] as Urgency[]).map((u) => (
                    <SelectItem key={u} value={u}>{URGENCY_LABEL[u]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fecha / rango */}
          <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="cal-goto" className="text-xs text-muted-foreground">Ir a fecha</Label>
              <Input
                id="cal-goto"
                type="date"
                className="w-full sm:w-[170px]"
                onChange={(e) => e.target.value && onGoToDate(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5 sm:flex-none">
                <Label htmlFor="cal-from" className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarRange className="size-3.5 shrink-0" /> Rango: desde
                </Label>
                <Input
                  id="cal-from"
                  type="date"
                  className="w-full sm:w-[160px]"
                  value={value.from}
                  max={value.to || undefined}
                  onChange={(e) => set("from", e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1.5 sm:flex-none">
                <Label htmlFor="cal-to" className="text-xs text-muted-foreground">hasta</Label>
                <Input
                  id="cal-to"
                  type="date"
                  className="w-full sm:w-[160px]"
                  value={value.to}
                  min={value.from || undefined}
                  onChange={(e) => set("to", e.target.value)}
                />
              </div>
            </div>

            {activeCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 sm:w-auto"
                onClick={() => onChange(EMPTY_FILTERS)}
              >
                <FilterX className="size-4" /> Limpiar filtros
              </Button>
            )}
          </div>

          {isRangeActive(value) && (
            <p className="mt-2 text-xs text-accent">
              Mostrando la agenda del rango seleccionado. Limpia el rango para volver a la vista por día.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
