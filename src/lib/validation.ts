import { z } from "zod";
import type { PrefModality, StableConn } from "@/types/database";

export const LIMITS = {
  name: 120,
  city: 80,
  whatsapp: 30,
  email: 150,
  availability: 300,
  observations: 1000,
} as const;

export function sanitizeText(input: string, { allowNewlines = false } = {}): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code <= 0x1f || code === 0x7f;
    const isAllowedNewline = allowNewlines && (code === 0x0a || code === 0x0d);
    if (isControl && !isAllowedNewline) continue;
    out += ch;
  }
  return out.trim();
}

export function sanitizePhone(input: string): string {
  const cleaned = input.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+")
    ? "+" + cleaned.slice(1).replace(/\+/g, "")
    : cleaned.replace(/\+/g, "");
}

const phoneRegex = /^\+?\d{7,15}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const intakeSchema = z.object({
  patient_name: z
    .string()
    .transform((s) => sanitizeText(s))
    .pipe(z.string().min(2, "Indica tu nombre.").max(LIMITS.name, "Nombre demasiado largo.")),

  patient_age: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 120),
      "Edad invalida."
    ),

  city: z
    .string()
    .transform((s) => sanitizeText(s))
    .pipe(z.string().max(LIMITS.city, "Ciudad demasiado larga."))
    .transform((s) => s || null),

  whatsapp: z
    .string()
    .transform((s) => sanitizePhone(s))
    .pipe(z.string().regex(phoneRegex, "Numero de WhatsApp invalido (7 a 15 digitos).")),

  email: z
    .string()
    .transform((s) => sanitizeText(s).toLowerCase())
    .pipe(
      z.union([
        z.string().length(0),
        z.string().regex(emailRegex, "Correo electronico invalido.").max(LIMITS.email),
      ])
    )
    .transform((s) => s || null),

  preferred_modality: z.enum(["videollamada", "llamada", "whatsapp_audio", "cualquiera"] as [
    PrefModality,
    ...PrefModality[]
  ]),

  has_stable_conn: z
    .enum(["si", "no", "a_veces"] as [StableConn, ...StableConn[]])
    .nullable()
    .optional()
    .transform((v) => v ?? null),

  available_days: z
    .string()
    .transform((s) => sanitizeText(s))
    .pipe(z.string().max(200))
    .transform((s) => s || null),

  available_times: z
    .string()
    .transform((s) => sanitizeText(s))
    .pipe(z.string().max(100))
    .transform((s) => s || null),

  availability: z
    .string()
    .transform((s) => sanitizeText(s))
    .pipe(z.string().max(LIMITS.availability, "Texto demasiado largo."))
    .transform((s) => s || null),

  observations: z
    .string()
    .transform((s) => sanitizeText(s, { allowNewlines: true }))
    .pipe(z.string().max(LIMITS.observations, "Observaciones demasiado largas."))
    .transform((s) => s || null),

  consent: z.literal(true, {
    errorMap: () => ({ message: "Debes autorizar el contacto para continuar." }),
  }),
});

export type IntakeValidated = z.infer<typeof intakeSchema>;
