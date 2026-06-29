import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("size-5 animate-spin text-muted-foreground", className)}
      aria-hidden="true"
    />
  );
}

export function FullPageSpinner({ label = "Cargando..." }: { label?: string }) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-8 text-accent" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
