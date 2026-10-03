import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ClipboardList, ScanFace, ShieldCheck, ShieldX, TriangleAlert, Trophy, Users } from "lucide-react";
import client from "../api/client";
import { Avatar, Badge, Card, EmptyState, PageLoader, PageShell, REASON_LABEL, ResultBadge, cx } from "../components/ui";
import { useCountUp, useRevealOnScroll } from "../hooks/useEffects";

const COLORS = { granted: "#34d399", denied: "#fb7185", unknown: "#fbbf24" };

function Kpi({ label, value, icon: Icon, tone, delta, sub, delay }) {
  const [ref, n] = useCountUp(value, { duration: 1000 });
  const tones = {
    cyan: "from-cyan-400/20 text-cyan-300",
    ok: "from-emerald-400/20 text-emerald-300",
    bad: "from-rose-400/20 text-rose-300",
    warn: "from-amber-400/20 text-amber-300",
  };
  return (
    <Card className="reveal relative overflow-hidden p-5" style={{ "--delay": `${delay}ms` }}>
      <div className={cx("pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-linear-to-br to-transparent blur-2xl", tones[tone])} />
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wider text-slate-400 uppercase">{label}</span>
        <Icon className={cx("size-5", tones[tone].split(" ").pop())} />
      </div>
      <p ref={ref} className="font-display text-4xl font-bold text-white tabular-nums">{n}</p>
      <div className="mt-2 flex h-5 items-center gap-2 text-xs text-slate-500">
        {delta != null && (
          <span className={cx("flex items-center gap-0.5 font-semibold", delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-slate-400")}>
            {delta > 0 ? <ArrowUpRight className="size-3.5" /> : delta < 0 ? <ArrowDownRight className="size-3.5" /> : null}
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
        {sub}
      </div>
    </Card>
  );
}

function WeekChart({ days }) {
  const [hover, setHover] = useState(null);
  const W = 700, H = 250, pad = { l: 34, r: 8, t: 12, b: 28 };
  const max = Math.max(4, ...days.map((d) => d.granted + d.denied + d.unknown));
  const niceMax = Math.ceil(max / 4) * 4;
  const bw = (W - pad.l - pad.r) / days.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const label = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Accesos de los últimos 7 días">
        {[0, 1, 2, 3, 4].map((i) => {
          const v = (niceMax / 4) * i;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="white" strokeOpacity={i ? 0.06 : 0.14} strokeDasharray={i ? "3 5" : ""} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">{v}</text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const x = pad.l + i * bw + bw * 0.2;
          const w = bw * 0.6;
          let acc = 0;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="white" opacity={hover === i ? 0.04 : 0} rx="8" />
              {["granted", "denied", "unknown"].map((k) => {
                const v = d[k];
                if (!v) return null;
                const top = y(acc + v), bottom = y(acc);
                acc += v;
                return <rect key={k} x={x} y={top} width={w} height={bottom - top - 1} rx="3" fill={COLORS[k]} opacity={hover == null || hover === i ? 0.95 : 0.4} className="transition-opacity" />;
              })}
              <text x={x + w / 2} y={H - 8} textAnchor="middle" className={cx("text-[11px]", hover === i ? "fill-white" : "fill-slate-500")}>{label(d.date)}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="glass pointer-events-none absolute top-2 right-2 rounded-xl bg-ink-900/90 px-3.5 py-2.5 text-xs">
          <p className="mb-1.5 font-semibold text-white capitalize">{label(days[hover].date)}</p>
          {[["granted", "Concedidos"], ["denied", "Denegados"], ["unknown", "Desconocidos"]].map(([k, l]) => (
            <p key={k} className="flex items-center gap-2 text-slate-300">
              <span className="size-2 rounded-full" style={{ background: COLORS[k] }} />{l}<b className="ml-auto pl-4 text-white tabular-nums">{days[hover][k]}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function HourStrip({ hours }) {
  const max = Math.max(1, ...hours);
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {hours.map((n, h) => (
          <div key={h} title={`${String(h).padStart(2, "0")}:00 · ${n} accesos`} className="aspect-[1/2.4] rounded-[4px] bg-cyan-400 transition-transform hover:scale-y-110" style={{ opacity: n ? 0.15 + (n / max) * 0.85 : 0.06 }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-slate-500">
        <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
    </div>
  );
}

function Donut({ granted, denied, unknown }) {
  const total = granted + denied + unknown;
  const r = 52, c = 2 * Math.PI * r;
  let offset = 0;
  const segs = [["granted", granted], ["denied", denied], ["unknown", unknown]];
  return (
    <div className="flex items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="14" />
          {total > 0 && segs.map(([k, v]) => {
            const len = (v / total) * c;
            const el = <circle key={k} cx="70" cy="70" r={r} fill="none" stroke={COLORS[k]} strokeWidth="14" strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-offset} strokeLinecap="round" />;
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div><p className="font-display text-3xl font-bold text-white tabular-nums">{total}</p><p className="text-[11px] text-slate-500">hoy</p></div>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm">
        {[["granted", "Concedidos", granted], ["denied", "Denegados", denied], ["unknown", "Desconocidos", unknown]].map(([k, l, v]) => (
          <li key={k} className="flex items-center gap-2.5 text-slate-300">
            <span className="size-2.5 rounded-full" style={{ background: COLORS[k] }} /> {l}
            <b className="ml-auto pl-3 text-white tabular-nums">{v}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

const timeFmt = (iso) => new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [updated, setUpdated] = useState(null);

  const load = useCallback(() => {
    client.get("dashboard/").then((r) => { setData(r.data); setUpdated(new Date()); setFailed(false); }).catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  useRevealOnScroll(!!data);

  if (!data) return failed ? <PageShell title="Dashboard"><EmptyState icon={TriangleAlert} title="No se pudieron cargar las métricas" text="Comprueba la conexión con el servidor." /></PageShell> : <PageLoader />;

  const maxTop = Math.max(1, ...data.top_employees.map((e) => e.count));

  return (
    <PageShell
      title="Dashboard"
      subtitle="Actividad de acceso en tiempo real."
      actions={<Badge tone="muted"><span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Actualizado {updated?.toLocaleTimeString("es-ES")}</Badge>}
    >
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Accesos hoy" value={data.accesses_today} icon={ScanFace} tone="cyan" delta={data.accesses_today - data.accesses_yesterday} sub="vs ayer" delay={0} />
        <Kpi label="Concedidos" value={data.granted_today} icon={ShieldCheck} tone="ok" sub="hoy" delay={70} />
        <Kpi label="Denegados" value={data.denied_today} icon={ShieldX} tone="bad" sub="inactivo o fuera de horario" delay={140} />
        <Kpi label="Desconocidos" value={data.unknown_today} icon={TriangleAlert} tone="warn" sub="rostros sin registrar" delay={210} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card className="reveal p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">Últimos 7 días</h2>
            <div className="flex gap-3 text-xs text-slate-400">
              {Object.entries({ granted: "Concedidos", denied: "Denegados", unknown: "Desconocidos" }).map(([k, l]) => (
                <span key={k} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: COLORS[k] }} />{l}</span>
              ))}
            </div>
          </div>
          <WeekChart days={data.last_7_days} />
        </Card>

        <Card className="reveal p-6" style={{ "--delay": "100ms" }}>
          <h2 className="mb-5 font-display text-lg font-semibold text-white">Resultado de hoy</h2>
          <Donut granted={data.granted_today} denied={data.denied_today} unknown={data.unknown_today} />
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/8 pt-5 text-sm">
            <div><p className="text-slate-500">Empleados activos</p><p className="font-display text-2xl font-bold text-white">{data.total_employees}</p></div>
            <div><p className="text-slate-500">Con rostro registrado</p><p className="font-display text-2xl font-bold text-white">{data.enrolled_employees}</p></div>
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="reveal p-6">
          <h2 className="mb-1 font-display text-lg font-semibold text-white">Franja horaria</h2>
          <p className="mb-5 text-xs text-slate-500">Accesos por hora en los últimos 7 días</p>
          <HourStrip hours={data.by_hour} />
        </Card>

        <Card className="reveal p-6" style={{ "--delay": "80ms" }}>
          <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-semibold text-white"><Trophy className="size-4.5 text-amber-300" /> Más activos (30 días)</h2>
          {data.top_employees.length === 0 ? <p className="text-sm text-slate-500">Sin datos todavía.</p> : (
            <ul className="space-y-4">
              {data.top_employees.map((e) => (
                <li key={e.employee_id} className="flex items-center gap-3">
                  <Avatar name={e.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between text-sm"><span className="truncate text-slate-200">{e.name}</span><b className="text-white tabular-nums">{e.count}</b></div>
                    <div className="h-1.5 rounded-full bg-white/8"><div className="h-full rounded-full bg-linear-to-r from-cyan-400 to-violet-500" style={{ width: `${(e.count / maxTop) * 100}%` }} /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="reveal p-6" style={{ "--delay": "160ms" }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">Actividad reciente</h2>
            <Link to="/access-logs" viewTransition className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200">Ver todo <ArrowRight className="size-3" /></Link>
          </div>
          {data.recent_logs.length === 0 ? <EmptyState icon={ClipboardList} title="Sin actividad" /> : (
            <ul className="space-y-3.5">
              {data.recent_logs.map((l) => (
                <li key={l.id} className="flex items-center gap-3">
                  <Avatar name={l.employee_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-200">{l.employee_name}</p>
                    <p className="text-xs text-slate-500">{timeFmt(l.timestamp)}{l.reason && ` · ${REASON_LABEL[l.reason]}`}</p>
                  </div>
                  <ResultBadge result={l.result} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-600"><Users className="size-3.5" /> Las métricas se calculan en la zona horaria del servidor.</p>
    </PageShell>
  );
}
