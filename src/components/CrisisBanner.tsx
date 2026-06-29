import { Phone, ShieldAlert } from "lucide-react";

/**
 * Banner de crisis. Se muestra cuando el triaje detecta riesgo alto
 * (peligro inmediato o ideacion de autolesion).
 * Los numeros son editables segun la localidad.
 */
export function CrisisBanner() {
  return (
    <div
      role="alert"
      className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 text-left"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert
          className="mt-0.5 size-6 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <p className="font-semibold text-destructive">
            Si tu vida o la de alguien corre peligro ahora, busca ayuda inmediata.
          </p>
          <p className="text-sm text-foreground/80">
            Esta plataforma ofrece apoyo psicologico, pero{" "}
            <strong>no sustituye a los servicios de emergencia</strong>. Si hay
            riesgo inmediato de dano, llama de inmediato:
          </p>
          <ul className="space-y-1 text-sm font-medium text-foreground">
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-destructive" aria-hidden="true" />
              <span>Emergencias: 911</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-destructive" aria-hidden="true" />
              <span>Linea de atencion en crisis: (configurar segun localidad)</span>
            </li>
          </ul>
          <p className="text-sm text-foreground/80">
            Igualmente registra tu solicitud: un profesional dara prioridad a tu
            caso.
          </p>
        </div>
      </div>
    </div>
  );
}
