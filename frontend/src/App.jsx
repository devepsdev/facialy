import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { Button, EmptyState, PageLoader, PageShell, ToastProvider } from "./components/ui";
import { BASE_PATH } from "./api/client";
import { AuthProvider, homeFor, useAuth } from "./lib/auth";
import { useScrollParallax } from "./hooks/useEffects";
import Home from "./pages/Home";

const Demo = lazy(() => import("./pages/Demo"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Me = lazy(() => import("./pages/Me"));
const Users = lazy(() => import("./pages/Users"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Employees = lazy(() => import("./pages/Employees"));
const AccessLogs = lazy(() => import("./pages/AccessLogs"));
const Kiosk = lazy(() => import("./pages/Kiosk"));

function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <PageShell title="Acceso restringido">
        <EmptyState icon={ShieldAlert} title="No tienes permisos para esta sección" text="Tu rol no incluye esta función. Si crees que es un error, contacta con un administrador.">
          <Button as={Link} to={homeFor(user.role)}>Ir a mi página de inicio</Button>
        </EmptyState>
      </PageShell>
    );
  }
  return children;
}

function Shell() {
  useScrollParallax();
  const { pathname } = useLocation();
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/me" element={<RequireAuth roles={["user", "admin", "superadmin"]}><Me /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth roles={["viewer", "admin", "superadmin"]}><Dashboard /></RequireAuth>} />
            <Route path="/employees" element={<RequireAuth roles={["viewer", "admin", "superadmin"]}><Employees /></RequireAuth>} />
            <Route path="/access-logs" element={<RequireAuth roles={["viewer", "admin", "superadmin"]}><AccessLogs /></RequireAuth>} />
            <Route path="/kiosk" element={<RequireAuth roles={["admin", "superadmin"]}><Kiosk /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth roles={["superadmin"]}><Users /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
      {pathname !== "/kiosk" && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={BASE_PATH || undefined}>
      <AuthProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
