import { supabase } from "@/lib/supabase";

export interface NotifyResult {
  ok: boolean;
  error?: string;
}

/**
 * Envia el correo de "caso asignado" al profesional. Se invoca de forma manual
 * (el coordinador decide cuando enviarlo, no ocurre automaticamente al asignar).
 * Nunca lanza: cualquier fallo (Resend, red, funcion no desplegada) se devuelve
 * como { ok: false, error } para que el caller lo muestre sin romper el flujo.
 */
export async function notifyProfessionalAssigned(
  caseId: string,
  professionalId: string
): Promise<NotifyResult> {
  try {
    const { data, error } = await supabase.functions.invoke("notify-assignment", {
      body: { caseId, professionalId },
    });
    if (error) return { ok: false, error: error.message };
    if (data && (data as NotifyResult).ok === false) {
      return { ok: false, error: (data as NotifyResult).error ?? "No se pudo enviar el correo." };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
