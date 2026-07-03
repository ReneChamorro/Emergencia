// Edge Function: notify-assignment
//
// Envia un correo (via Resend) al profesional cuando se le asigna un caso nuevo.
// Se invoca desde el frontend con supabase.functions.invoke("notify-assignment", { body: { caseId, professionalId } }).
//
// Corre con permisos de service role (inyectados automaticamente por Supabase) para poder:
//  - leer el email del profesional desde auth.users (profiles no guarda email)
//  - leer los datos del caso sin depender de RLS
//
// Nunca lanza un error duro: si falla el envio, responde 200 con { ok: false, error }
// para no bloquear el flujo de asignacion en el frontend (llamada "fire and forget").

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ?? "Apoyo Psicologico de Emergencia <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URGENCY_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { caseId, professionalId } = await req.json();
    if (!caseId || !professionalId) {
      return json({ ok: false, error: "Faltan caseId/professionalId" }, 400);
    }
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY no esta configurada como secret de la Edge Function.");
      return json({ ok: false, error: "RESEND_API_KEY no configurada" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: userRes, error: userErr }, { data: caseRow, error: caseErr }, { data: profileRow }] =
      await Promise.all([
        admin.auth.admin.getUserById(professionalId),
        admin
          .from("cases")
          .select("patient_name, urgency, whatsapp, city")
          .eq("id", caseId)
          .single(),
        admin.from("profiles").select("full_name").eq("id", professionalId).single(),
      ]);

    if (userErr || !userRes?.user?.email) {
      return json({ ok: false, error: "No se encontro el correo del profesional" });
    }
    if (caseErr || !caseRow) {
      return json({ ok: false, error: "No se encontro el caso" });
    }

    const firstName = profileRow?.full_name ? profileRow.full_name.split(" ")[0] : "";
    const urgencyLabel = URGENCY_LABEL[caseRow.urgency] ?? caseRow.urgency;

    const html = `
      <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; color: #1a1a1a;">
        <h2 style="color:#0f2c5c; margin-bottom: 4px;">Nuevo caso asignado</h2>
        <p>Hola${firstName ? " " + escapeHtml(firstName) : ""},</p>
        <p>Se te ha asignado un nuevo caso en <strong>Apoyo Psicologico de Emergencia</strong>:</p>
        <table style="border-collapse:collapse; margin: 12px 0;">
          <tr><td style="padding:4px 12px 4px 0;color:#666;">Paciente</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(caseRow.patient_name)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666;">Urgencia</td><td style="padding:4px 0;">${escapeHtml(urgencyLabel)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666;">WhatsApp</td><td style="padding:4px 0;">${escapeHtml(caseRow.whatsapp)}</td></tr>
          ${caseRow.city ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">Ciudad</td><td style="padding:4px 0;">${escapeHtml(caseRow.city)}</td></tr>` : ""}
        </table>
        <p>Ingresa a tu panel de profesional para ver el detalle completo y agendar la cita.</p>
      </div>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: userRes.user.email,
        subject: `Nuevo caso asignado: ${caseRow.patient_name}`,
        html,
      }),
    });

    if (!resendRes.ok) {
      console.error("Resend error:", await resendRes.text());
      return json({ ok: false, error: "Resend rechazo el envio" });
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: String(e) });
  }
});
