import { z } from "zod";

// Limites alineados con las restricciones CHECK de la base de datos
// (supabase/migrations/0002_security.sql). Mantener ambos en sincronia.
export const LIMITS = {
  name: 120,
  city: 80,
  whatsapp: 30,
  reason: 2000,
  availability: 300,
} as const;

/**
 * Quita caracteres de control (C0/C1 y DEL) y recorta espacios.
 * Con allowNewlines conserva los saltos de linea (\n y \r) en textos largos.
 * Se recorre por codepoint para no incrustar caracteres de control en el fuente.
 */
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

/** Deja solo digitos y un posible "+" inicial para el numero de WhatsApp. */
export function sanitizePhone(input: string): string {
  const cleaned = input.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+")
    ? "+" + cleaned.slice(1).replace(/\+/g, "")
    : cleaned.replace(/\+/g, "");
}

const phoneRegex = /^\+?\d{7,15}$/;

export const intakeSchema = z.object({
  patient_name: z
    .string()
    .transform((s) => sanitizeText(s))
    .pipe(
      z
        .string()
        .min(2, "Indica tu nombre.")
        .max(LIMITS.name, "El nombre es demasiado largo.")
    ),
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
    .pipe(
      z
        .string()
        .regex(phoneRegex, "Numero de WhatsApp invalido (7 a 15 digitos).")
    ),
  main_reason: z
    .string()
    .transform((s) => sanitizeText(s, { allowNewlines: true }))
    .pipe(
      z
        .string()
        .min(3, "Cuentanos brevemente en que necesitas apoyo.")
        .max(LIMITS.reason, "El texto es demasiado largo.")
    ),
  availability: z
    .string()
    .transform((s) => sanitizeText(s))
    .pipe(z.string().max(LIMITS.availability, "Texto demasiado larga."))
    .transform((s) => s || null),
  in_danger: z.boolean(),
  self_harm_ideation: z.boolean(),
  is_alone: z.boolean(),
  lost_family_home: z.boolean(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Debes aceptar el consentimiento." }),
  }),
});

export type IntakeValidated = z.infer<typeof intakeSchema>;
