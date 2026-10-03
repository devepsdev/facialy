import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Fingerprint, LockKeyhole, RotateCcw, ScanFace, ShieldCheck, ShieldX, Sparkles, Trash2, Users } from "lucide-react";
import client from "../api/client";
import FaceCamera from "../components/FaceCamera";
import { Badge, Button, Card, Field, cx, inputClass } from "../components/ui";
import useCamera from "../hooks/useCamera";
import useCapture, { HINTS } from "../hooks/useCapture";
import { useLoop } from "../hooks/useEffects";

const STEPS = ["Nombre", "Captura", "Reconocimiento"];

function Stepper({ current }) {
  return (
    <ol className="mx-auto mb-10 flex max-w-md items-center justify-center">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-2">
            <span
              className={cx(
                "grid size-9 place-items-center rounded-full border text-sm font-bold transition-all duration-500",
                i < current && "border-emerald-400/50 bg-emerald-400/15 text-emerald-300",
                i === current && "border-transparent bg-linear-to-br from-cyan-400 to-violet-500 text-ink-950 shadow-lg shadow-cyan-500/30",
                i > current && "border-white/10 bg-white/5 text-slate-500",
              )}
            >
              {i < current ? <Check className="size-4.5" /> : i + 1}
            </span>
            <span className={cx("text-xs font-medium", i === current ? "text-white" : "text-slate-500")}>{label}</span>
          </div>
          {i < STEPS.length - 1 && <span className={cx("mx-3 mb-6 h-px w-14 transition-colors duration-500 sm:w-24", i < current ? "bg-emerald-400/50" : "bg-white/10")} />}
        </li>
      ))}
    </ol>
  );
}

function ProgressRing({ value, size = 120, label }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" className="stroke-white/8" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          stroke="url(#ring-grad)" strokeDasharray={c} strokeDashoffset={c * (1 - value)}
          className="transition-[stroke-dashoffset] duration-300"
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute font-display text-2xl font-bold text-white tabular-nums">{label}</span>
    </div>
  );
}

function SimilarityMeter({ value, threshold }) {
  return (
    <div>
      <div className="relative h-2 rounded-full bg-white/8">
        <div className={cx("h-full rounded-full transition-all duration-200", value >= threshold ? "bg-emerald-400" : "bg-rose-400")} style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }} />
        <span className="absolute -top-1 h-4 w-0.5 bg-white/70" style={{ left: `${threshold * 100}%` }} title={`Umbral ${threshold}`} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-slate-500">
        <span>0</span><span>umbral {threshold.toFixed(2)}</span><span>1</span>
      </div>
    </div>
  );
}

export default function Demo() {
  const camera = useCamera();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [rawStage, setStage] = useState("intro"); // intro | capture | recognize
  const [threshold, setThreshold] = useState(0.4);
  const [results, setResults] = useState([]);
  const [recError, setRecError] = useState("");
  const sessionId = useRef(null);

  useEffect(() => {
    client.get("config/").then((r) => setThreshold(r.data.match_threshold)).catch(() => {});
  }, []);

  const capture = useCapture({
    camera,
    startSession: useCallback(async () => {
      const { data } = await client.post("demo/start/", { name: name.trim() });
      sessionId.current = data.session_id;
      return data;
    }, [name]),
    capturePath: () => "demo/capture/",
    onComplete: () => setTimeout(() => setStage("recognize"), 700),
  });

  const start = () => {
    setStage("capture");
    capture.begin();
  };

  // Si falla el arranque (cámara denegada, demos llenas, sesión caducada) se muestra de nuevo el formulario
  const failed = capture.phase === "error" || (capture.phase === "idle" && camera.status === "error");
  const stage = rawStage === "capture" && failed ? "intro" : rawStage;
  useEffect(() => {
    if (rawStage === "capture" && failed) camera.stop();
  }, [rawStage, failed, camera]);

  useLoop(
    async () => {
      const frame = camera.grab();
      if (!frame || !sessionId.current) return;
      try {
        const { data } = await client.post("demo/recognize/", { session_id: sessionId.current, frame });
        setResults(data.results);
        setRecError("");
      } catch (e) {
        if (e.response?.data?.code === "session_expired") setRecError("La sesión ha caducado. Reinicia la demo.");
      }
    },
    stage === "recognize" && !recError,
    260,
  );

  const finish = useCallback(async () => {
    const sid = sessionId.current;
    sessionId.current = null;
    camera.stop();
    capture.reset();
    setResults([]);
    setRecError("");
    setStage("intro");
    if (sid) client.post("demo/end/", { session_id: sid }).catch(() => {});
  }, [camera, capture]);

  useEffect(() => {
    return () => {
      const sid = sessionId.current;
      if (sid) client.post("demo/end/", { session_id: sid }).catch(() => {});
    };
  }, []);

  const stepIndex = stage === "intro" ? 0 : stage === "capture" ? 1 : 2;
  const known = results.find((r) => r.known);
  const top = results.reduce((best, r) => (!best || r.similarity > best.similarity ? r : best), null);

  const overlayFaces =
    stage === "capture"
      ? capture.box ? [{ box: capture.box, tone: capture.hint === "ok" ? "scan" : "warn" }] : []
      : results.map((r) => ({ box: r.box, tone: r.known ? "ok" : "bad", label: r.known ? r.name : "Desconocido", sub: r.similarity.toFixed(2) }));

  return (
    <main className="relative min-h-screen overflow-hidden pt-28 pb-20">
      <div className="grid-bg absolute inset-0 -z-10 opacity-60" />
      <div className="absolute -top-20 left-1/2 -z-10 h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px]" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <Badge tone="info" className="mb-4"><Sparkles className="size-3" /> Demo interactiva</Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Regístrate y comprueba que te reconoce</h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">Todo ocurre en una sesión temporal: nada se guarda en la base de datos y los datos caducan solos.</p>
        </div>

        <Stepper current={stepIndex} />

        {stage === "intro" && (
          <Card className="mx-auto max-w-md animate-pop bg-ink-900/60 p-7">
            <div className="mb-6 text-center">
              <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-linear-to-br from-cyan-400/20 to-violet-500/20 text-cyan-300"><ScanFace className="size-7" /></span>
              <h2 className="font-display text-xl font-semibold text-white">¿Cómo te llamas?</h2>
              <p className="mt-1 text-sm text-slate-400">Es el nombre que aparecerá cuando te reconozca.</p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && consent) start(); }} className="space-y-5">
              <Field label="Nombre">
                <input className={inputClass} placeholder="Ej: María García" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
              </Field>
              <ul className="space-y-2.5 rounded-xl border border-white/8 bg-white/3 p-4 text-sm text-slate-300">
                <li className="flex gap-2.5"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-emerald-400" /> Las imágenes no se almacenan: solo un vector numérico en RAM.</li>
                <li className="flex gap-2.5"><Trash2 className="mt-0.5 size-4 shrink-0 text-emerald-400" /> Todo se borra al terminar o a los 10 minutos.</li>
                <li className="flex gap-2.5"><Users className="mt-0.5 size-4 shrink-0 text-cyan-400" /> Tu sesión es privada: otros visitantes no pueden verte.</li>
              </ul>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-cyan-400" />
                Acepto que se use mi cámara durante esta demo.
              </label>
              {capture.error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{capture.error}</p>}
              {camera.error && !capture.error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{camera.error}</p>}
              <Button type="submit" className="w-full" disabled={!name.trim() || !consent}>Activar cámara <ArrowRight className="size-4" /></Button>
            </form>
          </Card>
        )}

        {stage !== "intro" && (
          <div className="grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
            <FaceCamera camera={camera} faces={overlayFaces} scanning={stage === "capture" || results.length === 0} idleText="Preparando cámara…">
              <div className="absolute top-4 left-4 z-10">
                <Badge tone={stage === "capture" ? "info" : "ok"} className="bg-ink-950/70 backdrop-blur">
                  <span className={cx("size-1.5 rounded-full", stage === "capture" ? "bg-cyan-300" : "bg-emerald-400", "animate-pulse")} />
                  {stage === "capture" ? "REGISTRANDO" : "EN VIVO"}
                </Badge>
              </div>
              {stage === "recognize" && results.length > 0 && (
                <div className="absolute inset-x-4 bottom-4 z-10">
                  <div className={cx("animate-pop rounded-2xl border px-4 py-3 text-center backdrop-blur-md", known ? "border-emerald-400/50 bg-emerald-950/80" : "border-rose-400/50 bg-rose-950/80")}>
                    <p className={cx("flex items-center justify-center gap-2 font-display text-lg font-bold tracking-wider", known ? "text-emerald-300" : "text-rose-300")}>
                      {known ? <ShieldCheck className="size-5" /> : <ShieldX className="size-5" />}
                      {known ? "ACCESO CONCEDIDO" : "IDENTIDAD NO VERIFICADA"}
                    </p>
                    {known && <p className="text-sm text-emerald-200/80">Bienvenido/a, {known.name}</p>}
                  </div>
                </div>
              )}
            </FaceCamera>

            <Card className="space-y-6 bg-ink-900/60 p-6">
              {stage === "capture" ? (
                <>
                  <div className="flex items-center gap-5">
                    <ProgressRing value={capture.progress.count / capture.progress.total} label={`${Math.round((capture.progress.count / capture.progress.total) * 100)}%`} />
                    <div>
                      <h2 className="font-display text-lg font-semibold text-white">Registrando tu rostro</h2>
                      <p className="mt-1 text-sm text-slate-400">{capture.progress.count} / {capture.progress.total} capturas válidas</p>
                    </div>
                  </div>
                  <div className={cx("rounded-xl border px-4 py-3 text-sm transition-colors", capture.hint === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200")}>
                    {HINTS[capture.hint] ?? HINTS.no_face}
                  </div>
                  <p className="text-sm text-slate-400">Gira la cabeza muy despacio a izquierda y derecha: cuanta más variedad, mejor te reconocerá.</p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold text-white">Reconocimiento en vivo</h2>
                    <Badge tone="ok">Registrado: {name.trim()}</Badge>
                  </div>

                  {recError ? (
                    <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{recError}</p>
                  ) : results.length === 0 ? (
                    <p className="rounded-xl border border-white/8 bg-white/3 px-4 py-6 text-center text-sm text-slate-400">Colócate frente a la cámara para ser identificado…</p>
                  ) : (
                    <div className="space-y-3">
                      {results.map((r, i) => (
                        <div key={i} className={cx("rounded-xl border p-4", r.known ? "border-emerald-500/30 bg-emerald-500/8" : "border-rose-500/25 bg-rose-500/8")}>
                          <div className="mb-3 flex items-center justify-between">
                            <span className="font-semibold text-white">{r.name}</span>
                            <Badge tone={r.known ? "ok" : "bad"}>{r.known ? "Autorizado" : "No autorizado"}</Badge>
                          </div>
                          <SimilarityMeter value={r.similarity} threshold={threshold} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/6 p-4 text-sm text-cyan-100/90">
                    <p className="mb-1 flex items-center gap-2 font-semibold text-cyan-200"><Fingerprint className="size-4" /> Pruébalo</p>
                    Tápate media cara, ponte unas gafas o invita a otra persona a entrar en el encuadre: debería aparecer como <em>Desconocido</em>.
                  </div>

                  {top && !known && <p className="text-xs text-slate-500">Mejor similitud actual: {top.similarity.toFixed(2)}</p>}
                </>
              )}

              <div className="flex flex-wrap gap-2 border-t border-white/8 pt-5">
                <Button variant="secondary" size="sm" onClick={finish}><RotateCcw className="size-3.5" /> {stage === "capture" ? "Cancelar" : "Borrar y reiniciar"}</Button>
                {stage === "recognize" && <Button as={Link} to="/login" variant="ghost" size="sm" viewTransition>Ver el panel de administración <ArrowRight className="size-3.5" /></Button>}
              </div>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}

