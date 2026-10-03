import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Power, ScanFace, ShieldCheck, ShieldX, TriangleAlert, Volume2, VolumeX } from "lucide-react";
import client, { errorMessage } from "../api/client";
import FaceCamera from "../components/FaceCamera";
import { Avatar, Badge, Button, Card, REASON_LABEL, ResultBadge, cx, useToast } from "../components/ui";
import useCamera from "../hooks/useCamera";
import { useLoop } from "../hooks/useEffects";

const VERDICT_HOLD_MS = 3500;

const VERDICT = {
  GRANTED: { title: "ACCESO CONCEDIDO", icon: ShieldCheck, box: "border-emerald-400/60 bg-emerald-950/70 shadow-[0_0_80px_-10px_rgb(52_211_153/0.5)]", text: "text-emerald-300", tone: "ok" },
  DENIED: { title: "ACCESO DENEGADO", icon: ShieldX, box: "border-rose-400/60 bg-rose-950/70 shadow-[0_0_80px_-10px_rgb(251_113_133/0.5)]", text: "text-rose-300", tone: "bad" },
  UNKNOWN: { title: "NO IDENTIFICADO", icon: TriangleAlert, box: "border-amber-300/60 bg-amber-950/60 shadow-[0_0_80px_-10px_rgb(252_211_77/0.4)]", text: "text-amber-300", tone: "warn" },
};

function useBeep(enabled) {
  const ctx = useRef(null);
  return useCallback((result) => {
    if (!enabled) return;
    try {
      ctx.current ??= new AudioContext();
      const c = ctx.current;
      const notes = result === "GRANTED" ? [[660, 0], [880, 0.12]] : result === "DENIED" ? [[220, 0], [180, 0.16]] : [[330, 0]];
      notes.forEach(([freq, at]) => {
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, c.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.18, c.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + 0.2);
        osc.connect(gain).connect(c.destination);
        osc.start(c.currentTime + at);
        osc.stop(c.currentTime + at + 0.22);
      });
    } catch { /* el audio es opcional */ }
  }, [enabled]);
}

export default function Kiosk() {
  const toast = useToast();
  const camera = useCamera();
  const [active, setActive] = useState(false);
  const [sound, setSound] = useState(true);
  const [faces, setFaces] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [events, setEvents] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const holdTimer = useRef(0);
  const verdictRef = useRef(null);
  const beep = useBeep(sound);
  const wrapRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = async () => {
    if (await camera.start()) setActive(true);
  };
  const stop = () => {
    setActive(false);
    camera.stop();
    setFaces([]);
  };

  useLoop(
    async () => {
      const frame = camera.grab(0.7);
      if (!frame) return;
      try {
        const { data } = await client.post("kiosk/recognize/", { frame });
        setFaces(data.results);
        const main = data.results.find((r) => r.result === "GRANTED") ?? data.results[0];
        if (main) {
          const prev = verdictRef.current;
          const isNew = !prev || prev.name !== main.name || prev.result !== main.result || Date.now() - prev.at > VERDICT_HOLD_MS;
          if (isNew) beep(main.result);
          // `since` fija cuándo empezó este veredicto (para animar solo al cambiar); `at` renueva el temporizador
          const next = { ...main, at: Date.now(), since: isNew ? Date.now() : prev.since };
          verdictRef.current = next;
          setVerdict(next);
          clearTimeout(holdTimer.current);
          holdTimer.current = setTimeout(() => {
            verdictRef.current = null;
            setVerdict(null);
          }, VERDICT_HOLD_MS);
        }
        const fresh = data.results.filter((r) => r.logged);
        if (fresh.length) setEvents((prev) => [...fresh.map((r) => ({ ...r, id: crypto.randomUUID(), at: new Date() })), ...prev].slice(0, 12));
      } catch (e) {
        if (e.response?.status !== 401) toast.error(errorMessage(e));
        stop();
      }
    },
    active,
    350,
  );

  useEffect(() => () => clearTimeout(holdTimer.current), []);

  const fullscreen = () => wrapRef.current?.requestFullscreen?.().catch(() => {});
  const v = verdict && VERDICT[verdict.result];

  return (
    <main ref={wrapRef} className="relative min-h-screen overflow-hidden bg-ink-950 pt-24 pb-10">
      <div className={cx("pointer-events-none absolute inset-0 transition-colors duration-700", v ? (verdict.result === "GRANTED" ? "bg-emerald-500/8" : verdict.result === "DENIED" ? "bg-rose-500/8" : "bg-amber-400/6") : "bg-transparent")} />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Kiosco de acceso</h1>
            <p className="text-slate-400">Reconocimiento continuo con registro automático de cada evento.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-3 text-right">
              <p className="font-display text-3xl font-bold text-white tabular-nums">{now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-xs text-slate-500 capitalize">{now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setSound((s) => !s)} aria-label="Sonido" title="Sonido">{sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</Button>
            <Button variant="secondary" size="sm" onClick={fullscreen} aria-label="Pantalla completa" title="Pantalla completa"><Maximize2 className="size-4" /></Button>
            {active ? <Button variant="danger" onClick={stop}><Power className="size-4" /> Detener</Button> : <Button onClick={start} loading={camera.status === "requesting"}><ScanFace className="size-4" /> Iniciar kiosco</Button>}
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="relative">
            <FaceCamera
              camera={camera} scanning={active && faces.length === 0} idleText="Pulsa «Iniciar kiosco» para activar la cámara" className="max-w-none"
              faces={faces.map((f) => ({ box: f.box, tone: VERDICT[f.result].tone, label: f.name, sub: f.similarity.toFixed(2) }))}
            >
              {v && (
                <div className="absolute inset-x-4 bottom-4 z-10 sm:inset-x-8 sm:bottom-8">
                  <div key={verdict.since} className={cx("animate-pop rounded-3xl border-2 px-6 py-5 text-center backdrop-blur-xl", v.box)}>
                    <p className={cx("flex items-center justify-center gap-3 font-display text-2xl font-bold tracking-widest sm:text-4xl", v.text)}><v.icon className="size-7 sm:size-10" /> {v.title}</p>
                    {verdict.result !== "UNKNOWN" && <p className="mt-1.5 text-lg text-white sm:text-2xl">{verdict.name}{verdict.department && <span className="text-base text-slate-300"> · {verdict.department}</span>}</p>}
                    {verdict.reason && <p className={cx("mt-1 text-sm", v.text)}>{REASON_LABEL[verdict.reason]}</p>}
                  </div>
                </div>
              )}
            </FaceCamera>
          </div>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-white">Eventos de esta sesión</h2>
              <Badge tone={active ? "ok" : "muted"}><span className={cx("size-1.5 rounded-full", active ? "animate-pulse bg-emerald-400" : "bg-slate-500")} /> {active ? "Activo" : "En pausa"}</Badge>
            </div>
            {events.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">Los accesos registrados aparecerán aquí.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex animate-pop items-center gap-3">
                    <Avatar name={e.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-100">{e.name}</p>
                      <p className="font-mono text-xs text-slate-500">{e.at.toLocaleTimeString("es-ES")} · {e.similarity.toFixed(2)}{e.reason && ` · ${REASON_LABEL[e.reason]}`}</p>
                    </div>
                    <ResultBadge result={e.result} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}
