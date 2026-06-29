// Tipos del dominio. Reflejan el esquema de supabase/migrations/0001_init.sql.
// Si conectas el proyecto Supabase, puedes regenerarlos con:
//   supabase gen types typescript --project-id <ref> > src/types/database.ts

export type UserRole = "coordinator" | "professional";
export type Urgency = "alta" | "media" | "baja";
export type CaseStatus =
  | "nuevo"
  | "asignado"
  | "en_contacto"
  | "cerrado"
  | "derivado";
export type ApptModality = "llamada" | "videollamada" | "presencial";
export type ApptStatus =
  | "programada"
  | "realizada"
  | "cancelada"
  | "no_asistio";

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
  patient_name: string;
  patient_age: number | null;
  city: string | null;
  whatsapp: string;
  main_reason: string;
  availability: string | null;
  in_danger: boolean;
  self_harm_ideation: boolean;
  is_alone: boolean;
  lost_family_home: boolean;
  urgency: Urgency;
  consent: boolean;
  status: CaseStatus;
  assigned_professional_id: string | null;
  notes: string | null;
}

export interface CaseWithProfessional extends Case {
  assigned_professional: Pick<Profile, "id" | "full_name"> | null;
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

export interface AppointmentWithCase extends Appointment {
  case: Case | null;
}

// Payload del formulario publico de intake (lo que inserta anon).
export type CaseIntakeInput = Pick<
  Case,
  | "patient_name"
  | "patient_age"
  | "city"
  | "whatsapp"
  | "main_reason"
  | "availability"
  | "in_danger"
  | "self_harm_ideation"
  | "is_alone"
  | "lost_family_home"
  | "urgency"
  | "consent"
>;
