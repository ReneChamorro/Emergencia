import type { Appointment, Case, Profile, Urgency } from "@/types/database";

// ---------- Tipos ----------

export interface AppointmentFull extends Appointment {
  case: Pick<Case, "id" | "patient_name" | "whatsapp" | "urgency" | "status" | "preferred_modality"> | null;
  professional: Pick<Profile, "id" | "full_name"> | null;
}

export interface ProfessionalGroup {
  professionalId: string;
  professionalName: string;
  appointments: AppointmentFull[];
}

// ---------- Helpers de fecha (sin dependencias externas) ----------

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/**
 * Devuelve los dias de la cuadricula mensual alineados al lunes.
 * Incluye dias del mes anterior/siguiente para completar la grilla.
 */
export function getCalendarGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // JS: 0=domingo…6=sabado. Convertimos a 0=lunes…6=domingo
  const startDow = (first.getDay() + 6) % 7;
  const grid: Date[] = [];

  // dias del mes anterior
  for (let i = startDow - 1; i >= 0; i--) {
    grid.push(new Date(year, month, -i));
  }
  // dias del mes actual
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) {
    grid.push(new Date(year, month, d));
  }
  // dias del mes siguiente para completar filas de 7
  const remaining = (7 - (grid.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    grid.push(new Date(year, month + 1, d));
  }
  return grid;
}

export function formatMonthHeader(d: Date): string {
  return d.toLocaleDateString("es-VE", { month: "long", year: "numeric" });
}

export function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- Agrupacion ----------

export function groupByDate(
  appts: AppointmentFull[]
): Map<string, AppointmentFull[]> {
  const map = new Map<string, AppointmentFull[]>();
  for (const a of appts) {
    const key = toDateKey(new Date(a.scheduled_at));
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  return map;
}

export function groupByProfessional(
  appts: AppointmentFull[]
): ProfessionalGroup[] {
  const map = new Map<string, ProfessionalGroup>();
  for (const a of appts) {
    const id = a.professional_id;
    const name = a.professional?.full_name ?? "(sin nombre)";
    const group = map.get(id) ?? { professionalId: id, professionalName: name, appointments: [] };
    group.appointments.push(a);
    map.set(id, group);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.professionalName.localeCompare(b.professionalName)
  );
}

// ---------- Dots del calendario ----------

export interface DotInfo {
  urgency: Urgency;
  count: number;
}

/** Hasta 3 dots + overflow. */
export function buildDots(appts: AppointmentFull[]): { dots: DotInfo[]; overflow: number } {
  const MAX = 3;
  const shown = appts.slice(0, MAX);
  const dots: DotInfo[] = shown.map((a) => ({
    urgency: (a.case?.urgency ?? "baja") as Urgency,
    count: 1,
  }));
  return { dots, overflow: Math.max(0, appts.length - MAX) };
}

export const DOT_COLOR: Record<Urgency, string> = {
  alta: "bg-destructive",
  media: "bg-warning",
  baja: "bg-success",
};
