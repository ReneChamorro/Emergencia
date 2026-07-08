import type { Appointment, AvailabilityBlock, Case, Profile, Urgency } from "@/types/database";

// ---------- Helpers de dia de la semana ----------

/** Convierte Date al sistema 0=lunes…6=domingo (igual que availability_blocks). */
export function dateToDayOfWeek(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Formatea "HH:MM:SS" (postgres time) a "HH:MM". */
export function formatBlockTime(t: string): string {
  return t.slice(0, 5);
}

// ---------- Tipos ----------

export interface AppointmentFull extends Appointment {
  case: Pick<Case, "id" | "patient_name" | "whatsapp" | "urgency" | "status" | "preferred_modality"> | null;
  professional: Pick<Profile, "id" | "full_name" | "age_groups"> | null;
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

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Parsea un input type="date" ("YYYY-MM-DD") como fecha local (evita el corrimiento de UTC). */
export function parseDateInput(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/** Formatea una Date a "YYYY-MM-DD" para un input type="date". */
export function toDateInputValue(d: Date): string {
  return toDateKey(d);
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

// ---------- Franja horaria ----------

export type TimeOfDay = "manana" | "tarde" | "noche";

function hourToFranja(h: number): TimeOfDay {
  if (h < 12) return "manana";
  if (h < 19) return "tarde";
  return "noche";
}

/**
 * Franja horaria de una cita segun la hora local:
 * mañana 00:00–11:59, tarde 12:00–18:59, noche 19:00–23:59.
 */
export function timeOfDay(iso: string): TimeOfDay {
  return hourToFranja(new Date(iso).getHours());
}

/** Igual que timeOfDay pero a partir de un string "HH:MM" (para franjas/slots sueltos, sin fecha). */
export function franjaOfTime(hhmm: string): TimeOfDay {
  const h = Number(hhmm.slice(0, 2));
  return hourToFranja(h);
}

export const TIME_OF_DAY_LABEL: Record<TimeOfDay, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  noche: "Noche",
};

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

// ---------- Franjas de 1 hora a partir de bloques de disponibilidad ----------

export interface HourSlot {
  start: string; // "HH:MM"
  end: string;
}

function minutesToHHMM(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Divide un bloque (puede durar varias horas) en franjas de 1 hora. La ultima franja puede ser mas corta. */
export function blockToHourSlots(block: AvailabilityBlock): HourSlot[] {
  const [startH, startM] = formatBlockTime(block.start_time).split(":").map(Number);
  const [endH, endM] = formatBlockTime(block.end_time).split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const slots: HourSlot[] = [];
  let cursor = startMinutes;
  while (cursor < endMinutes) {
    const next = Math.min(cursor + 60, endMinutes);
    slots.push({ start: minutesToHHMM(cursor), end: minutesToHHMM(next) });
    cursor = next;
  }
  return slots;
}

/** Une las franjas de varios bloques (de un mismo profesional/dia), ordenadas y sin duplicados por hora de inicio. */
export function buildHourSlots(blocks: AvailabilityBlock[]): HourSlot[] {
  const all = blocks.flatMap(blockToHourSlots);
  const unique = new Map<string, HourSlot>();
  for (const s of all) unique.set(s.start, s);
  return Array.from(unique.values()).sort((a, b) => a.start.localeCompare(b.start));
}

export function timeInRange(time: string, start: string, end: string): boolean {
  return time >= start && time < end;
}

/**
 * Devuelve los bloques activos para una fecha concreta, uniendo
 * bloques semanales recurrentes (day_of_week) y bloques puntuales (specific_date).
 */
export function getBlocksForDate(blocks: AvailabilityBlock[], date: Date): AvailabilityBlock[] {
  const dow = dateToDayOfWeek(date);
  const dateStr = toDateKey(date);
  return blocks.filter(
    (b) =>
      b.active &&
      ((b.specific_date === null && b.day_of_week === dow) ||
        b.specific_date === dateStr)
  );
}
