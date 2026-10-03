/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, Loader2, TriangleAlert, X } from "lucide-react";

export const cx = (...parts) => parts.filter(Boolean).join(" ");

// ─── Botones ────────────────────────────────────────────────────────────────

const BUTTON_VARIANTS = {
  primary:
    "bg-linear-to-r from-cyan-400 to-violet-500 text-ink-950 font-semibold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/40 hover:brightness-110",
  secondary: "glass text-white hover:bg-white/10",
  ghost: "text-slate-300 hover:text-white hover:bg-white/8",
  danger: "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25",
  success: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25",
};
const BUTTON_SIZES = { sm: "px-3 py-1.5 text-xs gap-1.5", md: "px-4 py-2.5 text-sm gap-2", lg: "px-6 py-3.5 text-base gap-2.5" };

export function Button({ variant = "primary", size = "md", loading, disabled, className, children, as: Tag = "button", ...props }) {
  return (
    <Tag
      disabled={Tag === "button" ? disabled || loading : undefined}
      className={cx(
        "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 active:scale-[0.97]",
        "disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Tag>
  );
}

// ─── Badges ─────────────────────────────────────────────────────────────────

const BADGE_TONES = {
  ok: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  bad: "bg-rose-500/12 text-rose-300 border-rose-500/25",
  warn: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  info: "bg-cyan-500/12 text-cyan-300 border-cyan-500/25",
  muted: "bg-white/5 text-slate-400 border-white/10",
};

export function Badge({ tone = "muted", className, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const RESULT_META = {
  GRANTED: { label: "Concedido", tone: "ok" },
  DENIED: { label: "Denegado", tone: "bad" },
  UNKNOWN: { label: "Desconocido", tone: "warn" },
};
export const REASON_LABEL = { INACTIVE: "Empleado inactivo", OUTSIDE_SCHEDULE: "Fuera de horario" };

export function ResultBadge({ result }) {
  const meta = RESULT_META[result] ?? RESULT_META.UNKNOWN;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

// ─── Contenedores ───────────────────────────────────────────────────────────

export function Card({ className, children, ...props }) {
  return (
    <div className={cx("glass rounded-2xl", className)} {...props}>
      {children}
    </div>
  );
}

/** Tarjeta con foco luminoso y borde que siguen al cursor. */
export function SpotlightCard({ className, children, ...props }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--x", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--y", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onPointerMove={onMove} className={cx("glass spotlight rounded-2xl", className)} {...props}>
      {children}
    </div>
  );
}

export function PageShell({ title, subtitle, actions, children }) {
  return (
    <main className="relative min-h-screen pt-28 pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgb(34_211_238/0.12),transparent)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
            {subtitle && <p className="mt-1.5 max-w-2xl text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </main>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx("size-5 animate-spin text-cyan-400", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/5 text-slate-400">
          <Icon className="size-7" />
        </div>
      )}
      <p className="font-display text-lg font-semibold text-white">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-400">{text}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

// ─── Formularios ────────────────────────────────────────────────────────────

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 " +
  "transition-colors focus:border-cyan-400/60 focus:bg-white/8 focus:outline-none focus:ring-2 focus:ring-cyan-400/20";

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-300">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-rose-400">{error}</span> : hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  "from-cyan-400 to-blue-500",
  "from-violet-400 to-fuchsia-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-indigo-500",
];

export function Avatar({ name = "?", size = "md" }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const dim = size === "lg" ? "size-14 text-lg" : size === "sm" ? "size-8 text-[11px]" : "size-10 text-sm";
  return (
    <div className={cx("grid shrink-0 place-items-center rounded-full bg-linear-to-br font-bold text-white shadow-inner", AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length], dim)}>
      {initials}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, wide, locked }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && !locked && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, locked]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !locked && onClose()} />
      <div className={cx("glass-solid relative my-8 w-full animate-pop rounded-3xl p-6 sm:p-7", wide ? "max-w-2xl" : "max-w-lg")}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
          <button onClick={onClose} disabled={locked} aria-label="Cerrar" className="-m-1 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Toasts ─────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);
const TOAST_ICON = { success: CheckCircle2, error: TriangleAlert, info: Info };
const TOAST_COLOR = { success: "text-emerald-400", error: "text-rose-400", info: "text-cyan-400" };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((type, message) => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const api = useMemo(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m) }),
    [push],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[90] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.type];
          return (
            <div key={t.id} className="glass-solid pointer-events-auto flex animate-pop items-start gap-3 rounded-xl p-3.5 text-sm text-slate-100">
              <Icon className={cx("mt-0.5 size-5 shrink-0", TOAST_COLOR[t.type])} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Eliminar", onConfirm, onCancel, loading }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} locked={loading}>
      <p className="text-sm leading-relaxed text-slate-300">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
