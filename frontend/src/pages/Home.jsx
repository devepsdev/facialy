import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BarChart3, Camera, ClipboardCheck, Clock, Cpu, Eye, Fingerprint, GitBranch, KeyRound, LockKeyhole, MonitorPlay,
  ScanFace, ShieldCheck, Sparkles, UserCheck, UserPlus, Zap,
} from "lucide-react";
import client from "../api/client";
import FaceMesh from "../components/FaceMesh";
import { GithubIcon } from "../components/Footer";
import { Badge, Button, SpotlightCard, cx } from "../components/ui";
import { useCountUp, useMouseParallax, useRevealOnScroll } from "../hooks/useEffects";

const TECH = [
  "OpenCV", "YuNet", "SFace", "Django 6", "Django REST", "React 19", "Vite 7", "Tailwind 4",
  "PostgreSQL", "Docker", "GitHub Actions", "Armbian", "Orange Pi 5", "Gunicorn", "WhiteNoise",
];

const STATS = [
  { value: 128, suffix: "", label: "dimensiones por embedding facial" },
  { value: 0, suffix: "", label: "fotografías guardadas en el servidor" },
  { value: 30, suffix: "", label: "capturas para registrar un rostro" },
  { value: 50, suffix: "+", label: "tests automatizados en el backend" },
];

const FEATURES = [
  {
    icon: Camera, title: "Registro desde el navegador", span: "md:col-span-2",
    text: "El empleado se registra con su webcam: el navegador envía fotogramas, el servidor extrae embeddings y se queda solo con el vector. Sin software que instalar, sin cámara en el servidor.",
    accent: "from-cyan-400/20",
  },
  {
    icon: ScanFace, title: "Reconocimiento en vivo", span: "",
    text: "Detección YuNet + embeddings SFace con OpenCV. Múltiples rostros por fotograma, a varios FPS en una SBC ARM.",
    accent: "from-violet-400/20",
  },
  {
    icon: Clock, title: "Reglas de acceso reales", span: "",
    text: "Horarios por empleado (incluidos turnos nocturnos), margen configurable y motivos de denegación: inactivo o fuera de horario.",
    accent: "from-emerald-400/20",
  },
  {
    icon: MonitorPlay, title: "Modo kiosco", span: "md:col-span-2",
    text: "Pantalla de control para la puerta: veredicto a pantalla completa, aviso sonoro, historial en vivo y registro automático de cada evento con anti-duplicados.",
    accent: "from-fuchsia-400/20",
  },
  {
    icon: BarChart3, title: "Dashboard y exportación", span: "",
    text: "Accesos por día, mapa de calor por hora, ranking de empleados y exportación CSV con filtros.",
    accent: "from-amber-400/20",
  },
  {
    icon: LockKeyhole, title: "Privacidad por diseño", span: "md:col-span-2",
    text: "Solo se almacenan vectores biométricos —nunca imágenes—, con borrado individual (derecho de supresión). La demo pública vive en memoria y caduca sola. API con autenticación por token y roles.",
    accent: "from-sky-400/20",
  },
];

const TRY_IT = [
  {
    icon: Sparkles, title: "Demo instantánea", badge: "Sin registro · 1 min", to: "/demo", cta: "Probar la demo",
    text: "Te registras con la webcam y compruebas que te reconoce. Todo en memoria: no se guarda nada.",
  },
  {
    icon: Eye, title: "Explorar el panel", badge: "Invitado · solo lectura", to: "/login", cta: "Entrar como invitado",
    text: "Dashboard, empleados y accesos con datos ficticios. Aislado de cualquier dato real y sin poder modificar nada.",
  },
  {
    icon: UserPlus, title: "Crear tu cuenta", badge: "Rol usuario · JWT", to: "/register", cta: "Registrarme",
    text: "Registra tu propio rostro, verifica tu identidad 1:1 y borra tus datos cuando quieras. Pendiente de aprobación, como en una empresa real.",
  },
];

const SECURITY = [
  { icon: KeyRound, title: "JWT con refresh rotatorio", text: "Access token de 15 min solo en memoria; refresh en cookie httpOnly + SameSite=Strict, rotado y revocable (lista negra)." },
  { icon: ShieldCheck, title: "4 roles con permisos reales", text: "Invitado, usuario, administrador y superadmin. Cada endpoint comprueba el rol en el servidor, no en la interfaz." },
  { icon: LockKeyhole, title: "Defensa ante fuerza bruta", text: "Límite de peticiones por IP, bloqueo temporal de la cuenta tras 5 fallos y mensajes que no revelan qué emails existen." },
  { icon: ClipboardCheck, title: "Auditoría y privacidad", text: "Registro de inicios de sesión, cambios de rol y borrados. Solo vectores biométricos, con derecho de supresión en un clic." },
];

const STEPS = [
  { icon: UserCheck, title: "Te presentas", text: "Introduces tu nombre y aceptas el uso de la cámara. Nada se guarda en base de datos." },
  { icon: Camera, title: "Captura guiada", text: "30 fotogramas válidos en unos segundos; el servidor descarta los borrosos o con varias caras." },
  { icon: Fingerprint, title: "Huella facial", text: "Cada rostro se alinea y se convierte en un vector de 128 dimensiones. Se descartan las imágenes." },
  { icon: ShieldCheck, title: "Acceso concedido", text: "En vivo se compara por similitud coseno: si supera el umbral, eres tú." },
];

function Stat({ value, suffix, label }) {
  const [ref, n] = useCountUp(value);
  return (
    <div ref={ref} className="reveal text-center">
      <div className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">
        <span className="text-gradient tabular-nums">{n}{suffix}</span>
      </div>
      <p className="mx-auto mt-2 max-w-[14rem] text-sm text-slate-400">{label}</p>
    </div>
  );
}

function FloatingChip({ className, children, delay = "0s" }) {
  return (
    <div className={cx("glass absolute z-20 flex items-center gap-2.5 rounded-2xl bg-ink-900/70 px-3.5 py-2.5 text-xs shadow-2xl", className)}>
      <div className="animate-float flex items-center gap-2.5" style={{ animationDelay: delay }}>{children}</div>
    </div>
  );
}

export default function Home() {
  useRevealOnScroll();
  const heroRef = useMouseParallax();
  const [engineUp, setEngineUp] = useState(null);

  useEffect(() => {
    client.get("health/").then((r) => setEngineUp(r.data.face_models)).catch(() => setEngineUp(false));
  }, []);

  return (
    <div className="overflow-x-clip">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="noise relative flex min-h-[100svh] items-center overflow-hidden pt-24 pb-16">
        <div className="absolute inset-0 -z-10">
          <div className="parallax absolute inset-0" style={{ "--speed": 0.05 }}>
            <div className="grid-bg absolute inset-0" />
          </div>
          <div className="parallax absolute -top-40 -left-40 size-[620px]" style={{ "--speed": 0.22 }}>
            <div className="size-full animate-aurora rounded-full bg-cyan-500/25 blur-[120px]" />
          </div>
          <div className="parallax absolute top-1/3 -right-48 size-[640px]" style={{ "--speed": 0.32 }}>
            <div className="size-full animate-aurora rounded-full bg-violet-600/30 blur-[130px] [animation-delay:-6s]" />
          </div>
          <div className="parallax absolute bottom-0 left-1/3 size-[420px]" style={{ "--speed": 0.12 }}>
            <div className="size-full animate-aurora rounded-full bg-fuchsia-500/15 blur-[110px] [animation-delay:-11s]" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-ink-950 to-transparent" />
        </div>

        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div className="parallax" style={{ "--speed": -0.06 }}>
            <div className="mouse-layer" style={{ "--depth": 6 }}>
              <Badge tone="info" className="mb-6 gap-2 px-3.5 py-1.5 text-xs">
                <span className="relative flex size-2">
                  <span className={cx("absolute inline-flex size-full animate-pulse-ring rounded-full", engineUp === false ? "bg-rose-400" : "bg-emerald-400")} />
                  <span className={cx("relative inline-flex size-2 rounded-full", engineUp === false ? "bg-rose-400" : engineUp ? "bg-emerald-400" : "bg-slate-500")} />
                </span>
                {engineUp === false ? "Motor facial sin conexión" : "Motor facial en línea · desplegado en Orange Pi 5"}
              </Badge>

              <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Tu cara es
                <br />
                <span className="text-gradient animate-[shine_6s_linear_infinite]">la llave.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
                Control de acceso con reconocimiento facial en tiempo real. Registra empleados desde el navegador, valida horarios,
                audita cada entrada y todo sin guardar una sola fotografía.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Button as={Link} to="/demo" viewTransition size="lg">
                  <Sparkles className="size-5" /> Probar la demo <ArrowRight className="size-4" />
                </Button>
                <Button as={Link} to="/login" viewTransition variant="secondary" size="lg">
                  <BarChart3 className="size-5" /> Ver el panel
                </Button>
                <Button as="a" href="https://github.com/devepsdev/facialy" target="_blank" rel="noopener noreferrer" variant="ghost" size="lg">
                  <GithubIcon className="size-5" /> Código
                </Button>
              </div>

              <p className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Cpu className="size-3.5" /> Solo CPU · sin GPU</span>
                <span className="flex items-center gap-1.5"><Zap className="size-3.5" /> Tiempo real</span>
                <span className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Datos biométricos mínimos</span>
              </p>
            </div>
          </div>

          {/* Visual: malla facial con capas a distinta profundidad */}
          <div className="relative mx-auto aspect-[5/6] w-full max-w-[460px]">
            <div className="mouse-layer absolute inset-0" style={{ "--depth": -14 }}>
              <div className="absolute inset-6 rounded-[2.5rem] border border-white/8 bg-linear-to-b from-white/5 to-transparent" />
            </div>
            <div className="mouse-layer absolute inset-0" style={{ "--depth": 18 }}>
              <FaceMesh className="relative size-full drop-shadow-[0_0_40px_rgb(34_211_238/0.25)]" />
            </div>
            <div className="mouse-layer absolute inset-0" style={{ "--depth": 34 }}>
              <FloatingChip className="top-[8%] -left-2 sm:-left-8">
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><ShieldCheck className="size-4.5" /></span>
                <div>
                  <p className="font-semibold text-white">ACCESO CONCEDIDO</p>
                  <p className="font-mono text-[11px] text-slate-400">Lucía Fernández · Ingeniería</p>
                </div>
              </FloatingChip>
              <FloatingChip className="right-0 bottom-[22%] sm:-right-6" delay="-2s">
                <span className="grid size-8 place-items-center rounded-lg bg-cyan-400/15 text-cyan-300"><Fingerprint className="size-4.5" /></span>
                <div>
                  <p className="font-semibold text-white">Similitud 0.87</p>
                  <p className="font-mono text-[11px] text-slate-400">umbral 0.40 · SFace 128-d</p>
                </div>
              </FloatingChip>
              <FloatingChip className="bottom-[4%] left-[6%]" delay="-4s">
                <span className="grid size-8 place-items-center rounded-lg bg-violet-400/15 text-violet-300"><GitBranch className="size-4.5" /></span>
                <div>
                  <p className="font-semibold text-white">CI/CD → Orange Pi 5</p>
                  <p className="font-mono text-[11px] text-slate-400">push a main · despliegue automático</p>
                </div>
              </FloatingChip>
            </div>
          </div>
        </div>
      </section>

      {/* ── Marquesina de tecnologías ─────────────────────────────────────── */}
      <section aria-label="Tecnologías" className="border-y border-white/6 bg-white/[0.015] py-6">
        <div className="marquee-mask overflow-hidden">
          <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
            {[...TECH, ...TECH].map((t, i) => (
              <span key={i} className="rounded-full border border-white/10 bg-white/4 px-5 py-2 font-display text-sm font-medium text-slate-300">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cifras ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          {STATS.map((s) => <Stat key={s.label} {...s} />)}
        </div>
      </section>

      {/* ── Bento de funcionalidades ──────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="parallax pointer-events-none absolute -top-10 right-0 -z-10 size-96 rounded-full bg-violet-600/10 blur-[110px]" style={{ "--speed": 0.1 }} />
        <div className="reveal mb-12 max-w-2xl">
          <Badge tone="info" className="mb-4">Funcionalidades</Badge>
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Mucho más que una <span className="text-gradient">demo de cámara</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">Un sistema de control de acceso completo: del registro del empleado al informe de auditoría.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, span, accent }, i) => (
            <SpotlightCard key={title} className={cx("reveal group p-7", span)} style={{ "--delay": `${(i % 3) * 90}ms` }}>
              <div className={cx("pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-linear-to-br to-transparent blur-3xl", accent)} />
              <div className="mb-5 grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-300 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                <Icon className="size-5.5" />
              </div>
              <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
              <p className="mt-2 leading-relaxed text-slate-400">{text}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {/* ── Cómo funciona ─────────────────────────────────────────────────── */}
      <section className="relative border-y border-white/6 bg-white/[0.012] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="reveal mb-14 text-center">
            <Badge tone="info" className="mb-4">Cómo funciona</Badge>
            <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">De la webcam al veredicto en 4 pasos</h2>
          </div>
          <div className="relative grid gap-6 md:grid-cols-4">
            <div className="absolute top-[34px] right-[12%] left-[12%] hidden h-px bg-linear-to-r from-transparent via-cyan-400/50 to-transparent md:block" />
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="reveal relative text-center" style={{ "--delay": `${i * 120}ms` }}>
                <div className="relative mx-auto mb-5 grid size-[68px] place-items-center rounded-2xl border border-white/10 bg-ink-900 text-cyan-300 shadow-xl shadow-cyan-500/10">
                  <Icon className="size-7" />
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-linear-to-br from-cyan-400 to-violet-500 text-xs font-bold text-ink-950">{i + 1}</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Arquitectura ──────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <div className="reveal">
          <Badge tone="info" className="mb-4">Ingeniería</Badge>
          <h2 className="font-display text-4xl font-bold tracking-tight text-white">Pensado como un producto, desplegado en una SBC</h2>
          <ul className="mt-6 space-y-3.5 text-slate-300">
            {[
              "Django 6 + DRF con autenticación por token, permisos por rol y throttling.",
              "Motor facial desacoplado: YuNet (detección) y SFace (embeddings) vía OpenCV, sin entrenamiento ni GPU.",
              "Registrar a alguien nuevo no toca a los demás: cada empleado aporta sus propias plantillas.",
              "PostgreSQL, Docker multi-stage, healthchecks y despliegue continuo con GitHub Actions en ARM64.",
              "SPA React 19 + Tailwind 4 servida por WhiteNoise: sin Node en producción.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <SpotlightCard className="reveal overflow-hidden bg-ink-900/80 font-mono text-[13px]" style={{ "--delay": "120ms" }}>
          <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
            <span className="size-3 rounded-full bg-rose-400/70" /><span className="size-3 rounded-full bg-amber-300/70" /><span className="size-3 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-slate-500">POST /api/kiosk/recognize/</span>
          </div>
          <pre className="overflow-x-auto p-5 leading-6 text-slate-300">
{`{
  "results": [{
    `}<span className="text-cyan-300">"name"</span>{`: `}<span className="text-emerald-300">"Lucía Fernández"</span>{`,
    `}<span className="text-cyan-300">"result"</span>{`: `}<span className="text-emerald-300">"GRANTED"</span>{`,
    `}<span className="text-cyan-300">"reason"</span>{`: `}<span className="text-emerald-300">""</span>{`,
    `}<span className="text-cyan-300">"similarity"</span>{`: `}<span className="text-amber-300">0.871</span>{`,
    `}<span className="text-cyan-300">"department"</span>{`: `}<span className="text-emerald-300">"Ingeniería"</span>{`,
    `}<span className="text-cyan-300">"box"</span>{`: [`}<span className="text-amber-300">0.31, 0.18, 0.27, 0.41</span>{`],
    `}<span className="text-cyan-300">"logged"</span>{`: `}<span className="text-violet-300">true</span>{`
  }]
}`}
          </pre>
        </SpotlightCard>
      </section>

      {/* ── Pruébalo (reclutadores / clientes) ───────────────────────────── */}
      <section className="relative border-y border-white/6 bg-white/[0.012] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="reveal mx-auto mb-12 max-w-2xl text-center">
            <Badge tone="info" className="mb-4">Pruébalo tú mismo</Badge>
            <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Tres formas de verlo funcionar</h2>
            <p className="mt-4 text-lg text-slate-400">Sin instalar nada y sin que toques datos de nadie.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {TRY_IT.map(({ icon: Icon, title, badge, text, to, cta }, i) => (
              <SpotlightCard key={title} className="reveal flex flex-col p-7" style={{ "--delay": `${i * 90}ms` }}>
                <div className="mb-5 flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-300"><Icon className="size-5.5" /></span>
                  <Badge tone="muted">{badge}</Badge>
                </div>
                <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 flex-1 leading-relaxed text-slate-400">{text}</p>
                <Button as={Link} to={to} viewTransition variant={i === 0 ? "primary" : "secondary"} className="mt-6">{cta} <ArrowRight className="size-4" /></Button>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Seguridad ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="reveal mb-12 max-w-2xl">
          <Badge tone="ok" className="mb-4"><ShieldCheck className="size-3" /> Seguridad</Badge>
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Pensado para que puedas fiarte</h2>
          <p className="mt-4 text-lg text-slate-400">Los datos biométricos son sensibles; el diseño parte de ahí.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SECURITY.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="reveal glass flex gap-4 rounded-2xl p-6" style={{ "--delay": `${(i % 2) * 90}ms` }}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><Icon className="size-5.5" /></span>
              <div>
                <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 py-28">
        <div className="parallax absolute inset-x-0 -top-20 -z-10 mx-auto h-[420px] max-w-3xl rounded-full bg-linear-to-r from-cyan-500/30 to-violet-600/30 blur-[120px]" style={{ "--speed": 0.12 }} />
        <div className="reveal mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">¿Te reconoce a ti?</h2>
          <p className="mt-4 text-lg text-slate-400">Pruébalo ahora con tu webcam. Tarda menos de un minuto y no se guarda nada.</p>
          <Button as={Link} to="/demo" viewTransition size="lg" className="mt-9">
            <Sparkles className="size-5" /> Empezar la demo <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
