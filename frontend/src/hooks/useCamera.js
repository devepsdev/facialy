import { useCallback, useEffect, useRef, useState } from "react";

/** Gestiona getUserMedia + captura de fotogramas JPEG (base64) del <video>. */
export default function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const linkRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | requesting | ready | error
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState(4 / 3);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no permite acceder a la cámara (se requiere HTTPS).");
      setStatus("error");
      return false;
    }
    setStatus("requesting");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      linkRef.current?.(videoRef.current);
      setStatus("ready");
      return true;
    } catch (e) {
      setError(
        e?.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Actívalo en la barra de direcciones y vuelve a intentarlo."
          : e?.name === "NotFoundError"
            ? "No se ha encontrado ninguna cámara."
            : "No se pudo acceder a la cámara.",
      );
      setStatus("error");
      return false;
    }
  }, []);

  // El <video> puede montarse antes o después de pedir el stream: enlazamos cuando ambos existen.
  const link = useCallback((node) => {
    if (!node || !streamRef.current || node.srcObject === streamRef.current) return;
    node.srcObject = streamRef.current;
    node.onloadedmetadata = () => {
      if (node.videoWidth) setAspect(node.videoWidth / node.videoHeight);
      node.play().catch(() => {});
    };
  }, []);

  useEffect(() => {
    linkRef.current = link;
  }, [link]);

  const attach = useCallback(
    (node) => {
      videoRef.current = node;
      link(node);
    },
    [link],
  );

  /** Fotograma actual como data URL JPEG, o null si el vídeo aún no está listo. */
  const grab = useCallback((quality = 0.72) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || video.readyState < 2) return null;
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", quality);
  }, []);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  return { attach, start, stop, grab, status, error, aspect };
}
