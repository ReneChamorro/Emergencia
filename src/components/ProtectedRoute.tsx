import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { FullPageSpinner } from "@/components/ui/spinner";
import type { UserRole } from "@/types/database";

interface Props {
  children: React.ReactNode;
  /** Roles permitidos. Si se omite, basta con estar autenticado. */
  allow?: UserRole[];
}

export function ProtectedRoute({ children, allow }: Props) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner label="Verificando sesion..." />;

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Sesion valida pero el profile aun no carga.
  if (!profile) return <FullPageSpinner label="Cargando perfil..." />;

  if (allow && !allow.includes(profile.role)) {
    // Rol incorrecto: enviar a su panel correspondiente.
    const home = profile.role === "professional" ? "/profesional" : "/coordinador";
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
