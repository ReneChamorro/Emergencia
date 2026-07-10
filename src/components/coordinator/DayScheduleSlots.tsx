import { Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { APPT_STATUS_LABEL } from "@/lib/domain";
import { GROUP_CAPACITY, occupiedGroupSpots, type AppointmentFull, type HourSlot } from "@/lib/calendarUtils";

/** Franja libre y clickeable dentro del panel de dia de un calendario de agendado. */
export function FreeSlotRow({
  slot,
  selected,
  onClick,
}: {
  slot: HourSlot;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? "border-accent bg-accent/10"
            : "border-dashed border-success/40 bg-success/5 hover:bg-success/10"
        )}
      >
        <span className={cn("w-12 shrink-0 text-xs font-semibold tabular-nums", selected ? "text-accent" : "text-success")}>
          {slot.start}
        </span>
        <span className={cn("flex-1 text-xs font-medium", selected ? "text-accent" : "text-success")}>
          Disponible hasta las {slot.end}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            selected ? "bg-accent/20 text-accent" : "bg-success/15 text-success"
          )}
        >
          <Plus className="size-3" /> {selected ? "Seleccionado" : "Elegir"}
        </span>
      </button>
    </li>
  );
}

/** Franja ya ocupada por una cita, mostrada de forma informativa (no clickeable). */
export function OccupiedSlotRow({ slot, appointment }: { slot: HourSlot; appointment: AppointmentFull }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <span className="w-12 shrink-0 text-xs font-semibold tabular-nums">{slot.start}</span>
      <span className="flex-1 truncate">{appointment.case?.patient_name ?? "Ocupado"}</span>
      <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium">
        Ocupado
      </span>
    </li>
  );
}

/**
 * Franja de consulta grupal: lista a los pacientes ya agendados en ese horario
 * (hasta GROUP_CAPACITY) y ofrece un boton para sumar uno mas si hay cupo.
 */
export function GroupSlotRow({
  slot,
  appointments,
  onAdd,
  disableAdd,
  selected,
  addLabel,
}: {
  slot: HourSlot;
  appointments: AppointmentFull[];
  onAdd: () => void;
  disableAdd?: boolean;
  selected?: boolean;
  /** Texto del boton de agregar. Por defecto "Seleccionado" si selected, si no "Agregar paciente". */
  addLabel?: string;
}) {
  const occupied = occupiedGroupSpots(appointments);
  const full = occupied >= GROUP_CAPACITY;

  return (
    <li
      className={cn(
        "space-y-2 rounded-lg border-2 px-3 py-2 text-sm",
        selected ? "border-accent bg-accent/10" : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-foreground">{slot.start}</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Users className="size-3" /> Grupal
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
            full ? "border-warning/40 bg-warning/15 text-warning-foreground" : "border-accent/30 bg-accent/10 text-accent"
          )}
        >
          {occupied}/{GROUP_CAPACITY}
        </span>
      </div>

      {appointments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pl-[3.75rem]">
          {appointments.map((a) => (
            <li key={a.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs">
              <span className={a.status !== "programada" ? "text-muted-foreground line-through" : "text-foreground"}>
                {a.case?.patient_name ?? "—"}
              </span>
              {a.status !== "programada" && (
                <Badge className="border-border bg-secondary px-1 py-0 text-[10px] text-secondary-foreground">
                  {APPT_STATUS_LABEL[a.status]}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="pl-[3.75rem] text-xs font-medium text-warning-foreground">Cupo lleno</p>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          disabled={disableAdd}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 rounded-md border-2 border-dashed px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            selected
              ? "border-accent bg-accent/10 text-accent"
              : "border-success/40 bg-success/5 text-success hover:bg-success/10"
          )}
        >
          <Plus className="size-3.5" /> {addLabel ?? (selected ? "Seleccionado" : "Agregar paciente")}
        </button>
      )}
    </li>
  );
}
