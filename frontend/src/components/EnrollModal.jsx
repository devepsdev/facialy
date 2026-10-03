import { useCallback, useState } from "react";
import { ScanFace } from "lucide-react";
import client, { errorMessage } from "../api/client";
import useCamera from "../hooks/useCamera";
import useCapture, { HINTS } from "../hooks/useCapture";
import FaceCamera from "./FaceCamera";
import { Button, Modal, cx, useToast } from "./ui";

/**
 * Registro guiado del rostro con la webcam.
 * `basePath`: "employees/{id}/enroll/" (admin) o "me/enroll/" (usuario sobre su propia cuenta).
 */
export default function EnrollModal({ title, subject, basePath, replacing, onClose, onEnrolled }) {
  const toast = useToast();
  const camera = useCamera();
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const capture = useCapture({
    camera,
    startSession: useCallback(async () => (await client.post(basePath + "start/")).data, [basePath]),
    capturePath: () => basePath + "capture/",
    onComplete: async (sid) => {
      setSaving(true);
      try {
        const { data } = await client.post(basePath + "finish/", { session_id: sid });
        camera.stop();
        toast.success("Rostro registrado correctamente");
        onEnrolled(data);
      } catch (e) {
        toast.error(errorMessage(e));
        capture.reset();
        setSaving(false);
      }
    },
  });

  const close = () => {
    camera.stop();
    onClose();
  };
  const running = ["running", "starting", "done"].includes(capture.phase);
  const pct = Math.round((capture.progress.count / capture.progress.total) * 100);

  return (
    <Modal open onClose={close} title={title} wide locked={saving}>
      {!running ? (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-slate-300">
            Se capturarán unos segundos de vídeo desde esta cámara. Solo se guarda una <b className="text-white">huella numérica</b> (128 valores) de {subject}; las imágenes se descartan al instante y puedes borrarla cuando quieras.
            {replacing && <span className="mt-2 block text-amber-300">Ya hay un rostro registrado: se sustituirá por el nuevo.</span>}
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-slate-300">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-cyan-400" />
            Confirmo que la persona ha dado su consentimiento para el tratamiento de sus datos biométricos con fines de control de acceso.
          </label>
          {(capture.error || camera.error) && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{capture.error || camera.error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>Cancelar</Button>
            <Button disabled={!consent} onClick={capture.begin}><ScanFace className="size-4" /> Activar cámara</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <FaceCamera camera={camera} scanning faces={capture.box ? [{ box: capture.box, tone: capture.hint === "ok" ? "scan" : "warn" }] : []} />
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className={cx(capture.hint === "ok" ? "text-emerald-300" : "text-amber-300")}>{saving ? "Guardando huella facial…" : HINTS[capture.hint]}</span>
              <span className="font-mono text-slate-400">{capture.progress.count}/{capture.progress.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-linear-to-r from-cyan-400 to-violet-500 transition-all duration-300" style={{ width: `${pct}%` }} /></div>
            <p className="mt-3 text-xs text-slate-500">Gira la cabeza lentamente a ambos lados para capturar distintos ángulos.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
