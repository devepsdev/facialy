import { useCallback, useEffect, useRef, useState } from "react";
import client, { errorMessage } from "../api/client";
import { useLoop } from "./useEffects";

export const HINTS = {
  ok: "Perfecto, sigue mirando a la cámara",
  no_face: "No veo ningún rostro: colócate frente a la cámara",
  too_small: "Acércate un poco más",
  low_quality: "Mejora la luz y mira de frente",
  multiple_faces: "Debe haber una sola persona en el encuadre",
  bad_frame: "Imagen no válida",
};

const CAPTURE_INTERVAL_MS = 220;

/**
 * Flujo de captura guiada compartido por la demo y el registro de empleados:
 *   cámara → sesión en el servidor → envío de fotogramas hasta completar `total`.
 *
 * @param camera       resultado de useCamera()
 * @param startSession () => Promise<{ session_id, total }>
 * @param capturePath  (sessionId) => URL relativa del endpoint de captura
 * @param onComplete   (sessionId) => void | Promise  (se llama al alcanzar el total)
 */
export default function useCapture({ camera, startSession, capturePath, onComplete }) {
  const [phase, setPhase] = useState("idle"); // idle | starting | running | done | error
  const [progress, setProgress] = useState({ count: 0, total: 30 });
  const [hint, setHint] = useState("no_face");
  const [box, setBox] = useState(null);
  const [error, setError] = useState("");
  const sessionRef = useRef(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const reset = useCallback(() => {
    sessionRef.current = null;
    completedRef.current = false;
    setPhase("idle");
    setProgress({ count: 0, total: 30 });
    setHint("no_face");
    setBox(null);
    setError("");
  }, []);

  const begin = useCallback(async () => {
    reset();
    setPhase("starting");
    if (!(await camera.start())) {
      setPhase("idle");
      return;
    }
    try {
      const data = await startSession();
      sessionRef.current = data.session_id;
      setProgress({ count: 0, total: data.total });
      setPhase("running");
    } catch (e) {
      camera.stop();
      setError(errorMessage(e));
      setPhase("error");
    }
  }, [camera, reset, startSession]);

  useLoop(
    async () => {
      const frame = camera.grab();
      const sid = sessionRef.current;
      if (!frame || !sid || completedRef.current) return;
      try {
        const { data } = await client.post(capturePath(sid), { session_id: sid, frame });
        setProgress({ count: data.count, total: data.total });
        setHint(data.hint);
        setBox(data.box);
        if (data.count >= data.total && !completedRef.current) {
          completedRef.current = true;
          setPhase("done");
          await onCompleteRef.current?.(sid);
        }
      } catch (e) {
        if (e.response?.data?.code === "session_expired") {
          completedRef.current = true;
          setError("La sesión ha caducado. Vuelve a empezar.");
          setPhase("error");
        }
      }
    },
    phase === "running",
    CAPTURE_INTERVAL_MS,
  );

  return { phase, progress, hint, box, error, begin, reset };
}
