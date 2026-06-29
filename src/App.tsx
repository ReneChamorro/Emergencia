import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FullPageSpinner } from "@/components/ui/spinner";
import Intake from "@/pages/Intake";
import Login from "@/pages/Login";
import Coordinador from "@/pages/Coordinador";
import Profesional from "@/pages/Profesional";
import NotFound from "@/pages/NotFound";

/** Redirige al panel segun el rol cuando se entra por una ruta de staff sin especificar. */
function StaffHome() {
  const { loading, session, profile } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!session || !profile) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={profile.role === "coordinator" ? "/coordinador" : "/profesional"}
      replace
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Intake />} />
      <Route path="/login" element={<Login />} />
      <Route path="/panel" element={<StaffHome />} />
      <Route
        path="/coordinador"
        element={
          <ProtectedRoute allow={["coordinator"]}>
            <Coordinador />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profesional"
        element={
          <ProtectedRoute allow={["professional", "coordinator"]}>
            <Profesional />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
