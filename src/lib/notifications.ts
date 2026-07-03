import { supabase } from "@/lib/supabase";

/**
 * Notifica por correo al profesional cuando se le asigna un caso nuevo.
 * Llamada "fire and forget": nunca bloquea ni interrumpe el flujo de asignacion
 * si el envio falla (falta de config de Resend, correo no encontrado, etc.).
 */
export function notifyProfessionalAssigned(caseId: string, professionalId: string): void {
  supabase.functions.invoke("notify-assignment", { body: { caseId, professionalId } }).catch((e) => {
    console.warn("No se pudo enviar la notificacion de asignacion:", e);
  });
}
