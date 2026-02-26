import { Link } from "react-router-dom";

const STEPS = [
  {
    icon: "👤",
    title: "Introduce tu nombre",
    desc: "El visitante ingresa su nombre en el formulario de la demo interactiva.",
  },
  {
    icon: "📸",
    title: "Captura facial",
    desc: "La webcam captura 100 imágenes de tu rostro automáticamente para entrenar el modelo.",
  },
  {
    icon: "🧠",
    title: "Entrenamiento IA",
    desc: "Django entrena un modelo EigenFace con OpenCV. Las fotos se eliminan del servidor.",
  },
  {
    icon: "✅",
    title: "Reconocimiento en vivo",
    desc: "El sistema identifica tu cara en tiempo real y simula la concesión de acceso.",
  },
];

const TECHS = [
  { name: "Django 6", icon: "🐍" },
  { name: "React 19", icon: "⚛️" },
  { name: "OpenCV", icon: "👁️" },
  { name: "PostgreSQL", icon: "🐘" },
  { name: "Docker", icon: "🐳" },
  { name: "GitHub Actions", icon: "⚙️" },
];

export default function Home() {
  return (
    <div className="pt-16">
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900" />
        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-900/50 border border-blue-700/60 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Sistema operativo — Proyecto de portfolio fullstack
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight tracking-tight">
            <span className="text-white">Control de Acceso</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              FACIAL
            </span>
          </h1>

          <p className="text-xl md:text-2xl font-semibold text-white mb-3">
            Facialy — Sistema de Control de Acceso Facial para Oficinas
          </p>
          <p className="text-sm text-slate-400 mb-12 font-mono tracking-wider">
            deveps · Django + React + OpenCV + Docker + CI/CD
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/demo"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl transition-all duration-200 shadow-xl shadow-blue-900/50 hover:shadow-blue-700/50 hover:-translate-y-0.5"
            >
              🎥 Probar Demo
            </Link>
            <a
              href="https://github.com/deveps"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 text-white font-semibold text-lg rounded-xl transition-all duration-200"
            >
              ⭐ Ver en GitHub
            </a>
          </div>

          {/* Scroll cue */}
          <div className="mt-20 flex justify-center animate-bounce opacity-40">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 bg-slate-900 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">¿Cómo funciona?</h2>
            <p className="text-slate-400 text-lg">Un flujo completo de reconocimiento facial en 4 pasos</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="relative bg-slate-800/80 rounded-2xl p-6 border border-slate-700 hover:border-blue-600/60 transition-all duration-200 group"
              >
                <div className="absolute -top-3.5 -left-3.5 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-900">
                  {i + 1}
                </div>
                <div className="text-4xl mb-4 mt-1">{step.icon}</div>
                <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture highlight ── */}
      <section className="py-20 bg-slate-800/40 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">Arquitectura del proyecto</h2>
              <p className="text-slate-400 mb-6 leading-relaxed">
                Aplicación fullstack desplegada en Docker. El frontend React se construye en tiempo de build
                y es servido directamente por Django + Whitenoise como archivos estáticos, sin servidor Node en producción.
              </p>
              <ul className="space-y-3">
                {[
                  "API REST con Django REST Framework",
                  "Reconocimiento facial con EigenFace (OpenCV contrib)",
                  "Base de datos PostgreSQL para logs de acceso",
                  "Docker multi-stage build optimizado",
                  "CI/CD con GitHub Actions",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-blue-400 mt-0.5">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700 font-mono text-sm">
              <div className="text-slate-500 mb-3 text-xs uppercase tracking-widest">Docker stack</div>
              {[
                { label: "nginx", detail: "reverse proxy  → /facialy/", color: "text-cyan-400" },
                { label: "django + gunicorn", detail: "app + static files", color: "text-green-400" },
                { label: "postgresql", detail: "access logs + employees", color: "text-blue-400" },
                { label: "opencv", detail: "face detection + training", color: "text-purple-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
                  <span className={`font-bold ${row.color}`}>{row.label}</span>
                  <span className="text-slate-500 text-xs ml-auto">{row.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tech stack ── */}
      <section className="py-24 bg-slate-900 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Stack Tecnológico</h2>
            <p className="text-slate-400">Tecnologías modernas para un sistema de producción real</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {TECHS.map((t) => (
              <div
                key={t.name}
                className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700 hover:border-blue-500/60 hover:bg-slate-700/60 transition-all duration-200 cursor-default"
              >
                <div className="text-3xl mb-2">{t.icon}</div>
                <div className="text-xs font-medium text-slate-300">{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-gradient-to-b from-slate-900 to-blue-950/60 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">¿Listo para probarlo?</h2>
          <p className="text-slate-400 text-lg mb-10">
            Prueba la demo interactiva y observa cómo el sistema aprende a reconocer tu rostro
            en tiempo real usando solo el navegador.
          </p>
          <Link
            to="/demo"
            className="inline-block px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl transition-all duration-200 shadow-xl shadow-blue-900/50 hover:-translate-y-0.5"
          >
            🎥 Probar Demo Ahora
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>Facialy &mdash; Proyecto de portfolio · Desarrollado por deveps</p>
          <a
            href="https://github.com/deveps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            github.com/deveps
          </a>
        </div>
      </footer>
    </div>
  );
}
