import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, LayoutDashboard, LogIn, LogOut, Menu, MonitorPlay, ScanFace, ShieldCheck, Sparkles, UserCircle, Users, X } from "lucide-react";
import { ROLE_LABEL, useAuth } from "../lib/auth";
import { Badge, cx } from "./ui";

const LINKS = [
  { to: "/demo", label: "Demo", icon: Sparkles },
  { to: "/me", label: "Mi perfil", icon: UserCircle, roles: ["user", "admin", "superadmin"] },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["viewer", "admin", "superadmin"] },
  { to: "/employees", label: "Empleados", icon: Users, roles: ["viewer", "admin", "superadmin"] },
  { to: "/access-logs", label: "Accesos", icon: ClipboardList, roles: ["viewer", "admin", "superadmin"] },
  { to: "/kiosk", label: "Kiosco", icon: MonitorPlay, roles: ["admin", "superadmin"] },
  { to: "/users", label: "Cuentas", icon: ShieldCheck, roles: ["superadmin"] },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // El menú móvil se cierra solo al cambiar de ruta: se guarda en qué ruta se abrió
  const [openPath, setOpenPath] = useState(null);
  const open = openPath === pathname;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = LINKS.filter((l) => !l.roles || (user && l.roles.includes(user.role)));

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[3px]">
        <div className="scroll-progress h-full bg-linear-to-r from-cyan-400 via-violet-500 to-fuchsia-500" />
      </div>
      <nav
        className={cx(
          "mx-auto flex h-14 max-w-6xl items-center justify-between rounded-2xl border px-3 transition-all duration-300 sm:px-4",
          scrolled || open ? "glass border-white/10 bg-ink-900/70" : "border-transparent",
        )}
      >
        <Link to="/" viewTransition className="group flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-cyan-400 to-violet-500 text-ink-950 shadow-lg shadow-cyan-500/30 transition-transform group-hover:rotate-6">
            <ScanFace className="size-5" strokeWidth={2.4} />
          </span>
          <span className="font-display text-lg font-bold tracking-[0.18em] text-white">FACIALY</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              viewTransition
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Badge tone={user.role === "superadmin" ? "warn" : user.role === "viewer" ? "muted" : "info"}>{user.role === "viewer" ? "Invitado · solo lectura" : `${ROLE_LABEL[user.role]}`}</Badge>
              <button onClick={handleLogout} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut className="size-4.5" />
              </button>
            </>
          ) : (
            <Link to="/login" viewTransition className="flex items-center gap-2 rounded-xl bg-white/8 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15">
              <LogIn className="size-4" /> Acceder
            </Link>
          )}
        </div>

        <button className="rounded-xl p-2 text-slate-300 hover:bg-white/10 md:hidden" onClick={() => setOpenPath(open ? null : pathname)} aria-label="Menú" aria-expanded={open}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {open && (
        <div className="glass mx-auto mt-2 max-w-6xl animate-pop rounded-2xl bg-ink-900/90 p-2 md:hidden">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx("flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium", isActive ? "bg-white/10 text-white" : "text-slate-300")}>
              <Icon className="size-4.5" /> {label}
            </NavLink>
          ))}
          {user ? (
            <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300">
              <LogOut className="size-4.5" /> Cerrar sesión ({ROLE_LABEL[user.role]})
            </button>
          ) : (
            <Link to="/login" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-cyan-300">
              <LogIn className="size-4.5" /> Acceder
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
