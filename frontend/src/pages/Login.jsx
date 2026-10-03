import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, KeyRound, Lock, ScanFace, User } from "lucide-react";
import client, { errorMessage } from "../api/client";
import FaceMesh from "../components/FaceMesh";
import { Button, Field, SpotlightCard, inputClass } from "../components/ui";
import { homeFor, useAuth } from "../lib/auth";

export default function Login() {
  const { user, login, loginAsGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const [config, setConfig] = useState({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    client.get("config/").then((r) => setConfig(r.data)).catch(() => {});
  }, []);

  if (user) return <Navigate to={from || homeFor(user.role)} replace />;

  const run = async (kind, fn) => {
    setBusy(kind);
    setError("");
    try {
      const u = await fn();
      navigate(from || homeFor(u.role), { replace: true });
    } catch (e) {
      setError(errorMessage(e, "No se pudo iniciar sesión."));
      setBusy("");
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 pt-24 pb-12">
      <div className="grid-bg absolute inset-0 -z-10" />
      <div className="absolute top-1/4 -left-32 -z-10 size-[480px] animate-aurora rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="absolute -right-32 bottom-0 -z-10 size-[480px] animate-aurora rounded-full bg-violet-600/25 blur-[120px] [animation-delay:-8s]" />

      <div className="grid w-full max-w-4xl items-center gap-8 md:grid-cols-[1fr_1.1fr]">
        <div className="hidden md:block">
          <FaceMesh className="mx-auto w-full max-w-[300px] drop-shadow-[0_0_40px_rgb(34_211_238/0.25)]" />
          <p className="mx-auto mt-6 flex max-w-xs items-start gap-2 text-xs text-slate-500">
            <KeyRound className="mt-0.5 size-3.5 shrink-0 text-cyan-400" />
            Sesión con JWT: el access token vive solo en memoria y el refresh token, rotatorio, en una cookie httpOnly.
          </p>
        </div>

        <SpotlightCard className="animate-pop bg-ink-900/70 p-8">
          <div className="mb-7 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-linear-to-br from-cyan-400 to-violet-500 text-ink-950"><ScanFace className="size-6" strokeWidth={2.4} /></span>
            <div>
              <h1 className="font-display text-2xl font-bold text-white">Iniciar sesión</h1>
              <p className="text-sm text-slate-400">Accede a tu perfil o al panel.</p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); run("login", () => login(username.trim(), password)); }} className="space-y-4">
            <Field label="Email o usuario">
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                <input className={inputClass + " pl-10"} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
              </div>
            </Field>
            <Field label="Contraseña">
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                <input type="password" className={inputClass + " pl-10"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </div>
            </Field>
            {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
            <Button type="submit" className="w-full" loading={busy === "login"} disabled={!!busy}>Entrar</Button>
          </form>

          {config.registration_enabled && (
            <p className="mt-5 text-center text-sm text-slate-400">
              ¿Primera vez? <Link to="/register" viewTransition className="font-medium text-cyan-300 hover:text-cyan-200">Crear una cuenta</Link>
            </p>
          )}

          {config.guest_login_enabled && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-slate-500">
                <span className="h-px flex-1 bg-white/10" /> o <span className="h-px flex-1 bg-white/10" />
              </div>
              <Button variant="secondary" className="w-full" loading={busy === "guest"} disabled={!!busy} onClick={() => run("guest", loginAsGuest)}>
                <Eye className="size-4" /> Explorar el panel como invitado
              </Button>
              <p className="mt-3 text-center text-xs text-slate-500">Solo lectura y únicamente con datos ficticios. Sin registro.</p>
            </>
          )}
        </SpotlightCard>
      </div>
    </main>
  );
}
