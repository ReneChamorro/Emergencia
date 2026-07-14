import { supabase } from "@/lib/supabase";
import type { CaseEventType } from "@/types/database";

/**
 * Registra un evento en el historial del caso (tabla case_events, ya
 * existente desde 0001_init.sql). Nunca lanza: un fallo aqui no debe
 * romper la accion principal que ya se guardo.
 */
export async function logCaseEvent(
  caseId: string,
  eventType: CaseEventType,
  detail: string,
  createdBy: string | null | undefined
) {
  try {
    await supabase.from("case_events").insert({
      case_id: caseId,
      event_type: eventType,
      detail,
      created_by: createdBy ?? null,
    });
  } catch {
    // Best-effort: el historial no debe bloquear la accion principal.
  }
}
