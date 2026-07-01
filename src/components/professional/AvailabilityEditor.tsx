import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useMyAvailability } from "@/hooks/useAvailabilityBlocks";
import type { AvailabilityBlock } from "@/types/database";
import { dateToDayOfWeek, formatBlockTime, toDateInputValue } from "@/lib/calendarUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle, CalendarDays, Clock, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Minutos desde medianoche a partir de "HH:MM" */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function AvailabilityEditor() {
  const { profile } = useAuth();
  const { blocks, loading, reload } = useMyAvailability();

  // --- Formulario semanal ---
  const [newDay, setNewDay] = useState("0");
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("13:00");
  const [addingWeekly, setAddingWeekly] = useState(false);
  const [weeklyFormError, setWeeklyFormError] = useState<string | null>(null);
  const [weeklyDeleteError, setWeeklyDeleteError] = useState<string | null>(null);

  // --- Formulario fecha específica ---
  const [specDate, setSpecDate] = useState(() => toDateInputValue(new Date()));
  const [specStart, setSpecStart] = useState("09:00");
  const [specEnd, setSpecEnd] = useState("13:00");
  const [addingSpec, setAddingSpec] = useState(false);
  const [specFormError, setSpecFormError] = useState<string | null>(null);
  const [specDeleteError, setSpecDeleteError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const weeklyBlocks = blocks.filter((b) => b.specific_date === null);
  const specificBlocks = blocks
    .filter((b) => b.specific_date !== null)
    .sort((a, b) => (a.specific_date ?? "").localeCompare(b.specific_date ?? ""));

  const byDay = Array.from({ length: 7 }, (_, i) =>
    weeklyBlocks.filter((b) => b.day_of_week === i)
  );

  // Comprueba si el bloque tiene citas programadas que lo bloqueen.
  async function checkConflicts(block: AvailabilityBlock): Promise<number> {
    const startMin = toMinutes(formatBlockTime(block.start_time));
    const endMin   = toMinutes(formatBlockTime(block.end_time));

    if (block.specific_date !== null) {
      // Bloque puntual: consultar ese día exacto
      const dayStart = new Date(block.specific_date + "T00:00:00").toISOString();
      const dayEnd   = new Date(block.specific_date + "T23:59:59").toISOString();
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_at")
        .eq("professional_id", block.professional_id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd)
        .eq("status", "programada");
      return ((data ?? []) as { scheduled_at: string }[]).filter((a) => {
        const d = new Date(a.scheduled_at);
        const t = d.getHours() * 60 + d.getMinutes();
        return t >= startMin && t < endMin;
      }).length;
    } else {
      // Bloque semanal recurrente: próximos 90 días
      const now    = new Date().toISOString();
      const future = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_at")
        .eq("professional_id", block.professional_id)
        .gte("scheduled_at", now)
        .lte("scheduled_at", future)
        .eq("status", "programada");
      return ((data ?? []) as { scheduled_at: string }[]).filter((a) => {
        const d = new Date(a.scheduled_at);
        const t = d.getHours() * 60 + d.getMinutes();
        return dateToDayOfWeek(d) === block.day_of_week && t >= startMin && t < endMin;
      }).length;
    }
  }

  async function handleDelete(block: AvailabilityBlock) {
    const isSpecific = block.specific_date !== null;
    if (isSpecific) setSpecDeleteError(null); else setWeeklyDeleteError(null);
    setDeletingId(block.id);

    const conflicts = await checkConflicts(block);
    if (conflicts > 0) {
      const msg = `No se puede eliminar: hay ${conflicts} cita${conflicts !== 1 ? "s" : ""} programada${conflicts !== 1 ? "s" : ""} en este horario. Cancélalas o desasígnalas primero.`;
      if (isSpecific) setSpecDeleteError(msg); else setWeeklyDeleteError(msg);
      setDeletingId(null);
      return;
    }

    await supabase.from("availability_blocks").delete().eq("id", block.id);
    setDeletingId(null);
    void reload();
  }

  async function handleToggle(block: AvailabilityBlock) {
    await supabase
      .from("availability_blocks")
      .update({ active: !block.active })
      .eq("id", block.id);
    void reload();
  }

  async function handleAddWeekly() {
    setWeeklyFormError(null);
    setWeeklyDeleteError(null);
    if (newStart >= newEnd) { setWeeklyFormError("La hora de inicio debe ser anterior a la hora de fin."); return; }
    if (!profile) return;
    setAddingWeekly(true);
    const { error } = await supabase.from("availability_blocks").insert({
      professional_id: profile.id,
      day_of_week: Number(newDay),
      specific_date: null,
      start_time: newStart,
      end_time: newEnd,
    });
    setAddingWeekly(false);
    if (error) { setWeeklyFormError("No se pudo guardar. Intenta de nuevo."); return; }
    void reload();
  }

  async function handleAddSpecific() {
    setSpecFormError(null);
    setSpecDeleteError(null);
    if (!specDate) { setSpecFormError("Selecciona una fecha."); return; }
    if (specStart >= specEnd) { setSpecFormError("La hora de inicio debe ser anterior a la hora de fin."); return; }
    if (!profile) return;
    setAddingSpec(true);
    const { error } = await supabase.from("availability_blocks").insert({
      professional_id: profile.id,
      day_of_week: null,
      specific_date: specDate,
      start_time: specStart,
      end_time: specEnd,
    });
    setAddingSpec(false);
    if (error) { setSpecFormError("No se pudo guardar. Intenta de nuevo."); return; }
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
          Define cuándo puedes atender. Los coordinadores lo verán al agendar citas.
        </p>
      </div>

      <Tabs defaultValue="semanal">
        <TabsList>
          <TabsTrigger value="semanal">Horario semanal</TabsTrigger>
          <TabsTrigger value="especifico" className="gap-1.5">
            Fechas específicas
            {specificBlocks.length > 0 && (
              <span className="inline-flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {specificBlocks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== SEMANAL ===== */}
        <TabsContent value="semanal" className="space-y-5 pt-4">
          <p className="text-sm text-muted-foreground">
            Estos bloques se repiten cada semana. Úsalos para tu disponibilidad habitual.
          </p>

          {weeklyDeleteError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {weeklyDeleteError}
            </div>
          )}

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
                      <BlockItem
                        key={b.id}
                        b={b}
                        deleting={deletingId === b.id}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium text-foreground">Agregar bloque semanal</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="av-day">Día</Label>
                  <Select value={newDay} onValueChange={setNewDay}>
                    <SelectTrigger id="av-day" className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="av-start">Desde</Label>
                  <Input id="av-start" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-[120px]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="av-end">Hasta</Label>
                  <Input id="av-end" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-[120px]" />
                </div>
                <Button onClick={handleAddWeekly} disabled={addingWeekly}>
                  {addingWeekly ? <Spinner className="text-primary-foreground" /> : <Plus className="size-4" />}
                  Agregar
                </Button>
              </div>
              {weeklyFormError && <p role="alert" className="mt-2 text-sm text-destructive">{weeklyFormError}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ESPECÍFICAS ===== */}
        <TabsContent value="especifico" className="space-y-5 pt-4">
          <p className="text-sm text-muted-foreground">
            Disponibilidad puntual para una fecha concreta — no se repite.
            Ideal cuando solo ese día específico puedes a determinada hora.
          </p>

          {specDeleteError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {specDeleteError}
            </div>
          )}

          {specificBlocks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center">
              <CalendarDays className="mx-auto mb-2 size-8 text-muted-foreground/40" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Sin fechas específicas agregadas.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {specificBlocks.map((b) => {
                const label = new Date(b.specific_date + "T00:00:00").toLocaleDateString("es-VE", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                });
                return (
                  <li
                    key={b.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
                      b.active ? "border-border bg-card" : "border-border/50 bg-muted/30"
                    )}
                  >
                    <div className={cn("flex flex-col gap-0.5", !b.active && "opacity-50")}>
                      <span className="font-medium capitalize text-foreground">{label}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatBlockTime(b.start_time)}–{formatBlockTime(b.end_time)}
                        {!b.active && " · inactivo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleToggle(b)}
                        className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {b.active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        title="Eliminar"
                        onClick={() => void handleDelete(b)}
                        disabled={deletingId === b.id}
                        className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
                      >
                        {deletingId === b.id
                          ? <Spinner className="size-3.5" />
                          : <Trash2 className="size-3.5" />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-medium text-foreground">Agregar fecha específica</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="spec-date">Fecha</Label>
                  <Input
                    id="spec-date"
                    type="date"
                    value={specDate}
                    min={toDateInputValue(new Date())}
                    onChange={(e) => setSpecDate(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spec-start">Desde</Label>
                  <Input id="spec-start" type="time" value={specStart} onChange={(e) => setSpecStart(e.target.value)} className="w-[120px]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="spec-end">Hasta</Label>
                  <Input id="spec-end" type="time" value={specEnd} onChange={(e) => setSpecEnd(e.target.value)} className="w-[120px]" />
                </div>
                <Button onClick={handleAddSpecific} disabled={addingSpec}>
                  {addingSpec ? <Spinner className="text-primary-foreground" /> : <Plus className="size-4" />}
                  Agregar
                </Button>
              </div>
              {specFormError && <p role="alert" className="mt-2 text-sm text-destructive">{specFormError}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BlockItem({
  b,
  deleting,
  onToggle,
  onDelete,
}: {
  b: AvailabilityBlock;
  deleting: boolean;
  onToggle: (b: AvailabilityBlock) => void;
  onDelete: (b: AvailabilityBlock) => void;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs",
        b.active ? "bg-accent/10 text-accent" : "bg-muted/50 text-muted-foreground line-through"
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
          onClick={() => onToggle(b)}
          className="rounded px-1 py-0.5 text-[10px] font-medium hover:bg-black/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {b.active ? "Activo" : "Inactivo"}
        </button>
        <button
          type="button"
          title="Eliminar bloque"
          onClick={() => onDelete(b)}
          disabled={deleting}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
        >
          {deleting ? <Spinner className="size-3" /> : <Trash2 className="size-3" />}
        </button>
      </div>
    </li>
  );
}
