import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useMyAvailability } from "@/hooks/useAvailabilityBlocks";
import type { AvailabilityBlock } from "@/types/database";
import { formatBlockTime } from "@/lib/calendarUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Trash2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function AvailabilityEditor() {
  const { profile } = useAuth();
  const { blocks, loading, reload } = useMyAvailability();

  const [newDay, setNewDay] = useState("0");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("13:00");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Agrupar por día
  const byDay = Array.from({ length: 7 }, (_, i) =>
    blocks.filter((b) => b.day_of_week === i)
  );

  async function handleAdd() {
    setFormError(null);
    if (newStart >= newEnd) {
      setFormError("La hora de inicio debe ser anterior a la hora de fin.");
      return;
    }
    if (!profile) return;
    setAdding(true);
    const { error } = await supabase.from("availability_blocks").insert({
      professional_id: profile.id,
      day_of_week: Number(newDay),
      start_time: newStart,
      end_time: newEnd,
    });
    setAdding(false);
    if (error) { setFormError("No se pudo guardar. Intenta de nuevo."); return; }
    void reload();
  }

  async function handleDelete(id: string) {
    await supabase.from("availability_blocks").delete().eq("id", id);
    void reload();
  }

  async function handleToggle(block: AvailabilityBlock) {
    await supabase
      .from("availability_blocks")
      .update({ active: !block.active })
      .eq("id", block.id);
    void reload();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Spinner className="size-4" /> Cargando disponibilidad...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Mi horario disponible</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Define los bloques de la semana en que puedes atender. El coordinador
          los verá al agendar citas.
        </p>
      </div>

      {/* Cuadrícula semanal */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {byDay.map((dayBlocks, dow) => (
          <div key={dow} className="rounded-lg border border-border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {DAY_NAMES[dow]}
            </p>
            {dayBlocks.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">Sin bloques</p>
            ) : (
              <ul className="space-y-1.5">
                {dayBlocks.map((b) => (
                  <li
                    key={b.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs",
                      b.active
                        ? "bg-accent/10 text-accent"
                        : "bg-muted/50 text-muted-foreground line-through"
                    )}
                  >
                    <span className="flex items-center gap-1 font-medium tabular-nums">
                      <Clock className="size-3 shrink-0" />
                      {formatBlockTime(b.start_time)}–{formatBlockTime(b.end_time)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title={b.active ? "Desactivar" : "Activar"}
                        onClick={() => void handleToggle(b)}
                        className="rounded px-1 py-0.5 text-[10px] font-medium hover:bg-black/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {b.active ? "Activo" : "Inactivo"}
                      </button>
                      <button
                        type="button"
                        title="Eliminar bloque"
                        onClick={() => void handleDelete(b.id)}
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Formulario de nuevo bloque */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Agregar bloque</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="av-day">Día</Label>
              <Select value={newDay} onValueChange={setNewDay}>
                <SelectTrigger id="av-day" className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av-start">Desde</Label>
              <Input
                id="av-start"
                type="time"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="w-[120px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="av-end">Hasta</Label>
              <Input
                id="av-end"
                type="time"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="w-[120px]"
              />
            </div>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? <Spinner className="text-primary-foreground" /> : <Plus className="size-4" />}
              Agregar
            </Button>
          </div>
          {formError && (
            <p role="alert" className="mt-2 text-sm text-destructive">{formError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
