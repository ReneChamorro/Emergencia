import type {
  CaseStatus,
  Urgency,
  ApptStatus,
  ApptModality,
  PrefModality,
  StableConn,
  AgeGroup,
} from "@/types/database";
import { formatTime } from "@/lib/calendarUtils";

// ---------- Etiquetas y estilos ----------

export const URGENCY_LABEL: Record<Urgency, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const URGENCY_ORDER: Record<Urgency, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

export const URGENCY_BADGE: Record<Urgency, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/30",
  media: "bg-warning/15 text-warning-foreground border-warning/40",
  baja: "bg-success/10 text-success border-success/30",
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  nuevo: "Nuevo",
  asignado: "Asignado",
  en_contacto: "En contacto",
  cerrado: "Cerrado",
  derivado: "Derivado",
};

export const STATUS_BADGE: Record<CaseStatus, string> = {
  nuevo: "bg-accent/10 text-accent border-accent/30",
  asignado: "bg-primary/10 text-primary border-primary/30",
  en_contacto: "bg-warning/15 text-warning-foreground border-warning/40",
  cerrado: "bg-muted text-muted-foreground border-border",
  derivado: "bg-secondary text-secondary-foreground border-border",
};

export const MODALITY_LABEL: Record<ApptModality, string> = {
  llamada: "Llamada",
  videollamada: "Videollamada",
  presencial: "Presencial",
};

export const PREF_MODALITY_LABEL: Record<PrefModality, string> = {
  videollamada: "Videollamada",
  llamada: "Llamada telefonica",
  whatsapp_audio: "WhatsApp / audio",
  cualquiera: "Cualquiera",
};

export const STABLE_CONN_LABEL: Record<StableConn, string> = {
  si: "Si",
  no: "No",
  a_veces: "A veces",
};

export const APPT_STATUS_LABEL: Record<ApptStatus, string> = {
  programada: "Programada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  no_asistio: "No asistio",
};

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  ninos_adolescentes: "Niños y adolescentes",
  adultos: "Adultos",
  adultos_mayores: "Adultos mayores",
};

export const AGE_GROUP_SHORT_LABEL: Record<AgeGroup, string> = {
  ninos_adolescentes: "Niños",
  adultos: "Adultos",
  adultos_mayores: "Mayores",
};

export const AGE_GROUP_BADGE: Record<AgeGroup, string> = {
  ninos_adolescentes: "bg-accent/10 text-accent border-accent/30",
  adultos: "bg-secondary text-secondary-foreground border-border",
  adultos_mayores: "bg-warning/15 text-warning-foreground border-warning/40",
};

// ---------- Formato ----------
const dtf = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso: string): string {
  try {
    return dtf.format(new Date(iso));
  } catch {
    return iso;
  }
}

const df = new Intl.DateTimeFormat("es-VE", { dateStyle: "medium" });
export function formatDate(iso: string): string {
  try {
    return df.format(new Date(iso));
  } catch {
    return iso;
  }
}

// ---------- WhatsApp ----------

/**
 * Construye un deep link wa.me. Normaliza el numero a digitos internacionales:
 * un numero local venezolano "0412…" se convierte en "58412…".
 * Si se pasa `text`, se adjunta como mensaje predeterminado.
 */
export function waLink(whatsapp: string, text?: string): string {
  let digits = whatsapp.replace(/[^\d]/g, "");
  if (digits.startsWith("0")) digits = "58" + digits.slice(1);
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** Mensaje predeterminado que se envia al paciente cuando se le asigna una cita. */
export function citaAsignadaMsg(scheduledAt: string): string {
  return (
    "Su cita con Apoyo Psicologico de Emergencia ha sido asignada el dia " +
    `${formatDate(scheduledAt)} a las ${formatTime(scheduledAt)}.`
  );
}
