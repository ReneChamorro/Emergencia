import { cn } from "@/lib/utils";

interface Props {
  legend: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  /** Resalta en rojo cuando la respuesta afirmativa indica riesgo. */
  dangerOnYes?: boolean;
}

/**
 * Par de botones Si/No, mas accesible que un checkbox para personas en crisis.
 * Usa role=radiogroup para lectores de pantalla.
 */
export function YesNoField({ legend, value, onChange, dangerOnYes }: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-base font-medium text-foreground">{legend}</legend>
      <div role="radiogroup" className="grid grid-cols-2 gap-3">
        <button
          type="button"
          role="radio"
          aria-checked={value === true}
          onClick={() => onChange(true)}
          className={cn(
            "flex h-12 items-center justify-center rounded-md border-2 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            value === true
              ? dangerOnYes
                ? "border-destructive bg-destructive/10 text-destructive"
                : "border-accent bg-accent/10 text-accent"
              : "border-input bg-background text-foreground hover:bg-secondary"
          )}
        >
          Si
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value === false}
          onClick={() => onChange(false)}
          className={cn(
            "flex h-12 items-center justify-center rounded-md border-2 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            value === false
              ? "border-primary bg-primary/5 text-primary"
              : "border-input bg-background text-foreground hover:bg-secondary"
          )}
        >
          No
        </button>
      </div>
    </fieldset>
  );
}
