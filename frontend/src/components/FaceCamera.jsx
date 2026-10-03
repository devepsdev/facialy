import { Camera, Loader2, VideoOff } from "lucide-react";
import { cx } from "./ui";

const TONES = {
  ok: { ring: "border-emerald-400", glow: "shadow-[0_0_24px_rgb(52_211_153/0.45)]", chip: "bg-emerald-400 text-emerald-950" },
  bad: { ring: "border-rose-400", glow: "shadow-[0_0_24px_rgb(251_113_133/0.45)]", chip: "bg-rose-400 text-rose-950" },
  warn: { ring: "border-amber-300", glow: "shadow-[0_0_24px_rgb(252_211_77/0.4)]", chip: "bg-amber-300 text-amber-950" },
  scan: { ring: "border-cyan-300", glow: "shadow-[0_0_24px_rgb(103_232_249/0.4)]", chip: "bg-cyan-300 text-cyan-950" },
};

function Corner({ className }) {
  return <span className={cx("absolute size-4 border-white/70", className)} />;
}

/**
 * Vídeo en espejo con HUD: marco de esquinas, línea de escaneo y cajas de rostro posicionadas en %.
 * `faces`: [{ box: [x, y, w, h] normalizado 0-1 (sin espejar), tone, label, sub }]
 */
export default function FaceCamera({ camera, faces = [], scanning = false, children, className, idleText = "Cámara apagada" }) {
  const { attach, status, error, aspect } = camera;
  const live = status === "ready";

  return (
    <div
      className={cx("glass-solid relative mx-auto w-full overflow-hidden rounded-3xl bg-black!", className)}
      style={{ aspectRatio: aspect, maxWidth: 720 }}
    >
      {/* El vídeo se muestra en espejo (como un selfie); las cajas se espejan a mano */}
      <video ref={attach} autoPlay playsInline muted className={cx("size-full -scale-x-100 object-cover transition-opacity duration-500", live ? "opacity-100" : "opacity-0")} />

      {!live && (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,rgb(34_211_238/0.08),transparent_60%)] text-slate-400">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            {status === "requesting" ? <Loader2 className="size-9 animate-spin text-cyan-400" /> : status === "error" ? <VideoOff className="size-9 text-rose-400" /> : <Camera className="size-9" />}
            <p className="max-w-xs text-sm">{status === "requesting" ? "Esperando permiso de cámara…" : status === "error" ? error : idleText}</p>
          </div>
        </div>
      )}

      {live && (
        <>
          <div className="pointer-events-none absolute inset-3">
            <Corner className="top-0 left-0 rounded-tl-lg border-t-2 border-l-2" />
            <Corner className="top-0 right-0 rounded-tr-lg border-t-2 border-r-2" />
            <Corner className="bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2" />
            <Corner className="right-0 bottom-0 rounded-br-lg border-r-2 border-b-2" />
          </div>
          {scanning && <div className="pointer-events-none absolute inset-x-0 h-24 animate-scan bg-linear-to-b from-transparent via-cyan-300/25 to-transparent" />}

          {faces.map((f, i) => {
            const [x, y, w, h] = f.box;
            const tone = TONES[f.tone] ?? TONES.scan;
            return (
              <div
                key={i}
                className={cx("pointer-events-none absolute rounded-xl border-2 transition-all duration-150 ease-out", tone.ring, tone.glow)}
                style={{ left: `${(1 - (x + w)) * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
              >
                {f.label && (
                  <div className={cx("absolute -top-7 left-0 flex max-w-[220%] items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap", tone.chip)}>
                    {f.label}
                    {f.sub && <span className="font-mono font-medium opacity-70">{f.sub}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      {children}
    </div>
  );
}
