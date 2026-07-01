export type UserRole      = "coordinator" | "professional" | "admin";
export type Urgency       = "alta" | "media" | "baja";
export type CaseStatus    = "nuevo" | "asignado" | "en_contacto" | "cerrado" | "derivado";
export type ApptModality  = "llamada" | "videollamada" | "presencial";
export type ApptStatus    = "programada" | "realizada" | "cancelada" | "no_asistio";
export type PrefModality  = "videollamada" | "llamada" | "whatsapp_audio" | "cualquiera";
export type StableConn    = "si" | "no" | "a_veces";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  specialty: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export interface Case {
  id: string;
  created_at: string;
  // Datos del paciente
  patient_name: string;
  patient_age: number | null;
  city: string | null;
  whatsapp: string;
  email: string | null;
  // Modalidad
  preferred_modality: PrefModality;
  has_stable_conn: StableConn | null;
  // Disponibilidad
  available_days: string | null;
  available_times: string | null;
  availability: string | null;
  // Observaciones paciente
  observations: string | null;
  // Gestion
  urgency: Urgency;
  consent: boolean;
  status: CaseStatus;
  assigned_professional_id: string | null;
  notes: string | null;
}

export interface Appointment {
  id: string;
  case_id: string;
  professional_id: string;
  scheduled_at: string;
  modality: ApptModality;
  status: ApptStatus;
  contact_number: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AvailabilityBlock {
  id: string;
  professional_id: string;
  /** 0=lunes…6=domingo. null para bloques de fecha específica. */
  day_of_week: number | null;
  /** "YYYY-MM-DD". null para bloques semanales recurrentes. */
  specific_date: string | null;
  start_time: string;  // "HH:MM:SS" (Postgres time)
  end_time: string;
  active: boolean;
  created_at: string;
}

// Payload del formulario publico de agendamiento.
export type CaseIntakeInput = Pick<
  Case,
  | "patient_name"
  | "patient_age"
  | "city"
  | "whatsapp"
  | "email"
  | "preferred_modality"
  | "has_stable_conn"
  | "available_days"
  | "available_times"
  | "availability"
  | "observations"
  | "consent"
>;
