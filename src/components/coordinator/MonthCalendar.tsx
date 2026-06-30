import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCalendarGrid,
  isSameDay,
  isToday,
  addMonths,
  formatMonthHeader,
  toDateKey,
  dateToDayOfWeek,
  buildDots,
  DOT_COLOR,
  type AppointmentFull,
} from "@/lib/calendarUtils";

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface Props {
  month: Date;
  selectedDay: Date;
  byDate: Map<string, AppointmentFull[]>;
  /** Dias de la semana (0=lunes...6=domingo) en los que algun profesional tiene disponibilidad. */
  availabilityDows: Set<number>;
  onDaySelect: (d: Date) => void;
  onMonthChange: (d: Date) => void;
}

export function MonthCalendar({
  month,
  selectedDay,
  byDate,
  availabilityDows,
  onDaySelect,
  onMonthChange,
}: Props) {
  const grid = getCalendarGrid(month.getFullYear(), month.getMonth());
  const isCurrentMonth = (d: Date) => d.getMonth() === month.getMonth();

  return (
    <div className="select-none">
      {/* Header de mes */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => onMonthChange(addMonths(month, -1))}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h2 className="text-sm font-semibold capitalize text-foreground">
          {formatMonthHeader(month)}
        </h2>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Encabezados de días */}
      <div className="mb-1 grid grid-cols-7">
        {WEEK_DAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Cuadrícula */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {grid.map((day, i) => {
          const key = toDateKey(day);
          const appts = byDate.get(key) ?? [];
          const { dots, overflow } = buildDots(appts);
          const inMonth = isCurrentMonth(day);
          const selected = isSameDay(day, selectedDay);
          const today = isToday(day);
          const hasAvailability = availabilityDows.has(dateToDayOfWeek(day));

          return (
            <button
              key={i}
              type="button"
              aria-label={`${day.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" })}${appts.length ? `, ${appts.length} citas` : ""}${hasAvailability ? ", con disponibilidad" : ""}`}
              aria-pressed={selected}
              onClick={() => onDaySelect(day)}
              className={cn(
                "relative flex min-h-[56px] flex-col items-center gap-1 bg-card px-1 pt-2 pb-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                !inMonth && "opacity-35",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary/60"
              )}
            >
              {/* Punto de disponibilidad (esquina superior derecha) */}
              {hasAvailability && (
                <span
                  className={cn(
                    "absolute right-1.5 top-1.5 size-1.5 rounded-full",
                    selected ? "bg-primary-foreground" : "bg-accent"
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Número de día */}
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm font-medium tabular-nums leading-none",
                  today && !selected &&
                    "ring-2 ring-accent ring-offset-1 ring-offset-card",
                  selected && "font-bold"
                )}
              >
                {day.getDate()}
              </span>

              {/* Dots de citas */}
              {appts.length > 0 && (
                <div className="flex items-center gap-0.5">
                  {dots.map((dot, di) => (
                    <span
                      key={di}
                      className={cn(
                        "size-1.5 rounded-full",
                        selected ? "bg-primary-foreground/80" : DOT_COLOR[dot.urgency]
                      )}
                    />
                  ))}
                  {overflow > 0 && (
                    <span
                      className={cn(
                        "text-[9px] font-semibold leading-none",
                        selected ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}
                    >
                      +{overflow}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
