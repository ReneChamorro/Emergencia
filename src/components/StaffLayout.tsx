import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { HeartPulse, LayoutDashboard, LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function StaffLayout({ title, subtitle, actions, children }: Props) {
  const { profile, signOut } = useAuth();

  // Coordinador y admin pueden acceder a ambos paneles
  const hasBothPanels = profile?.role === "coordinator" || profile?.role === "admin";

  const roleLabel =
    profile?.role === "coordinator"
      ? "Coordinacion"
      : profile?.role === "admin"
      ? "Administracion"
      : "Profesional";

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-primary text-primary-foreground">
        <div className="container flex h-16 items-center justify-between gap-4">
          {/* Logo + rol */}
          <div className="flex items-center gap-2.5 shrink-0">
            <HeartPulse className="size-6 text-accent" aria-hidden="true" />
            <div className="leading-tight">
              <p className="text-sm font-semibold">Apoyo Psicologico de Emergencia</p>
              <p className="text-xs text-primary-foreground/70">
                {roleLabel}
                {profile?.full_name ? ` · ${profile.full_name}` : ""}
              </p>
            </div>
          </div>

          {/* Navegación entre paneles (solo coordinador y admin) */}
          {hasBothPanels && (
            <nav className="flex items-center gap-1" aria-label="Paneles">
              <NavLink
                to="/coordinador"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  )
                }
              >
                <LayoutDashboard className="size-3.5" />
                <span className="hidden sm:inline">Coordinación</span>
              </NavLink>
              <NavLink
                to="/profesional"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  )
                }
              >
                <UserCog className="size-3.5" />
                <span className="hidden sm:inline">Mi perfil profesional</span>
              </NavLink>
            </nav>
          )}

          {/* Salir */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground shrink-0"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <main className="container py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
