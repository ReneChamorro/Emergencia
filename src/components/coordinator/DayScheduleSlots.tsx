import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppointmentFull, HourSlot } from "@/lib/calendarUtils";

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
