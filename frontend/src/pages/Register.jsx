import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Lock, Mail, ScanFace, ShieldCheck } from "lucide-react";
import client, { errorMessage } from "../api/client";
import { Button, Field, SpotlightCard, inputClass } from "../components/ui";
import { homeFor, useAuth } from "../lib/auth";

function strength(pw) {
  let score = 0;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 16) score++;
  return score;
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(true);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", accept_terms: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  useEffect(() => {
    client.get("config/").then((r) => setEnabled(r.data.registration_enabled)).catch(() => {});
  }, []);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const u = await register(form);
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      const data = err.response?.data;
      setErrors(data && typeof data === "object" && !data.error ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, [].concat(v)[0]])) : { form: errorMessage(err) });
      setBusy(false);
    }
  };

  const score = strength(form.password);
  const bars = ["bg-rose-400", "bg-amber-400", "bg-lime-400", "bg-emerald-400"];

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 pt-24 pb-12">
      <div className="grid-bg absolute inset-0 -z-10" />
      <div className="absolute -top-20 right-0 -z-10 size-[480px] animate-aurora rounded-full bg-violet-600/25 blur-[120px]" />

      <SpotlightCard className="w-full max-w-md animate-pop bg-ink-900/70 p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-linear-to-br from-cyan-400 to-violet-500 text-ink-950"><ScanFace className="size-6" strokeWidth={2.4} /></span>
          <div>
            <h1 className="font-display text-2xl font-bold text-white">Crear cuenta</h1>
            <p className="text-sm text-slate-400">Registra tu rostro y verifica tu identidad.</p>
          </div>
        </div>

        {!enabled ? (
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">El registro público está desactivado en este servidor.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" error={errors.first_name}><input className={inputClass} value={form.first_name} onChange={set("first_name")} autoComplete="given-name" required autoFocus /></Field>
              <Field label="Apellidos"><input className={inputClass} value={form.last_name} onChange={set("last_name")} autoComplete="family-name" /></Field>
            </div>
            <Field label="Email" error={errors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                <input type="email" className={inputClass + " pl-10"} value={form.email} onChange={set("email")} autoComplete="email" required />
              </div>
            </Field>
            <Field label="Contraseña" error={errors.password} hint="Mínimo 8 caracteres; evita contraseñas comunes.">
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                <input type="password" className={inputClass + " pl-10"} value={form.password} onChange={set("password")} autoComplete="new-password" required />
              </div>
              <div className="mt-2 flex gap-1.5" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${form.password && i < score ? bars[score - 1] : "bg-white/10"}`} />)}
              </div>
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/4 p-3.5 text-sm text-slate-300">
              <input type="checkbox" checked={form.accept_terms} onChange={set("accept_terms")} className="mt-0.5 size-4 accent-cyan-400" />
              <span>Acepto el tratamiento de mis datos, incluido mi vector biométrico facial (no se guardan imágenes), y que puedo borrarlos cuando quiera.</span>
            </label>
            {errors.accept_terms && <p className="text-xs text-rose-400">{errors.accept_terms}</p>}
            {errors.form && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{errors.form}</p>}

            <Button type="submit" className="w-full" loading={busy} disabled={!form.accept_terms}>Crear cuenta</Button>
          </form>
        )}

        <p className="mt-5 flex items-start gap-2 text-xs text-slate-500">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
          Tu cuenta queda pendiente de aprobación por un administrador antes de poder acceder a ninguna instalación.
        </p>
        <p className="mt-4 text-center text-sm text-slate-400">¿Ya tienes cuenta? <Link to="/login" viewTransition className="font-medium text-cyan-300 hover:text-cyan-200">Inicia sesión</Link></p>
      </SpotlightCard>
    </main>
  );
}
