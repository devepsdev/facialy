import { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

const TOTAL = 100;
const CAPTURE_INTERVAL_MS = 200;

// ─── Step indicator ─────────────────────────────────────────────────────────

const STEP_ORDER = ["name", "camera", "capturing", "training", "recognizing"];
const STEP_LABELS = {
  name: "Nombre",
  camera: "Cámara",
  capturing: "Captura",
  training: "Entrenamiento",
  recognizing: "Reconocimiento",
};

function StepIndicator({ current }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  return (
    <div className="flex items-center justify-center flex-wrap gap-1">
      {STEP_ORDER.map((key, i) => (
        <div key={key} className="flex items-center gap-1">
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              i < currentIdx
                ? "bg-green-800/70 text-green-300 border border-green-700"
                : i === currentIdx
                ? "bg-blue-600 text-white border border-blue-500"
                : "bg-slate-700/60 text-slate-500 border border-slate-600"
            }`}
          >
            {i < currentIdx ? "✓ " : `${i + 1}. `}
            {STEP_LABELS[key]}
          </div>
          {i < STEP_ORDER.length - 1 && (
            <div
              className={`w-4 h-px ${i < currentIdx ? "bg-green-700" : "bg-slate-700"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Name step ──────────────────────────────────────────────────────────────

function NameStep({ visitorName, setVisitorName, onNext }) {
  return (
    <div className="max-w-md mx-auto bg-slate-800 rounded-2xl p-8 border border-slate-700">
      <div className="text-center mb-7">
        <span className="text-5xl">👤</span>
        <h2 className="text-xl font-bold text-white mt-4">¿Cómo te llamas?</h2>
        <p className="text-slate-400 text-sm mt-2">
          Introduce tu nombre para registrarte en el sistema de acceso
        </p>
      </div>
      <input
        type="text"
        placeholder="Ej: María García"
        value={visitorName}
        onChange={(e) => setVisitorName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && visitorName.trim() && onNext()}
        className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 mb-5 transition-colors"
        autoFocus
      />
      <button
        onClick={onNext}
        disabled={!visitorName.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
      >
        Continuar →
      </button>
    </div>
  );
}

// ─── Camera permission step ──────────────────────────────────────────────────

function CameraStep({ onStart }) {
  return (
    <div className="max-w-md mx-auto bg-slate-800 rounded-2xl p-8 border border-slate-700 text-center">
      <div className="text-5xl mb-5">📸</div>
      <h2 className="text-xl font-bold text-white mb-3">Activar Cámara</h2>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
        Necesitamos acceso a tu cámara para capturar imágenes de tu rostro y entrenar
        el modelo de reconocimiento facial.
      </p>
      <div className="bg-slate-700/50 rounded-xl p-4 mb-6 text-left border border-slate-600/50">
        <ul className="text-slate-300 text-sm space-y-2.5">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5 shrink-0">🔒</span>
            Las imágenes son temporales y se eliminan automáticamente tras el entrenamiento
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-0.5 shrink-0">📡</span>
            El procesamiento ocurre en el servidor — solo se envían frames JPEG comprimidos
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5 shrink-0">⏱</span>
            La captura y entrenamiento toman aproximadamente 30-60 segundos
          </li>
        </ul>
      </div>
      <button
        onClick={onStart}
        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl transition-colors"
      >
        🎥 Activar Cámara
      </button>
    </div>
  );
}

// ─── Live video + overlay ────────────────────────────────────────────────────

function VideoPanel({
  videoRef,
  overlayCanvasRef,
  step,
  captureCount,
  faceDetected,
  captureMessage,
  accessGranted,
  recognitionResults,
  visitorName,
  employeeId,
  onCleanup,
}) {
  const progress = Math.min((captureCount / TOTAL) * 100, 100);

  return (
    <div className="space-y-5">
      {/* Video feed with canvas overlay */}
      <div
        className="relative bg-black rounded-2xl overflow-hidden border border-slate-700 mx-auto"
        style={{ maxWidth: 640, aspectRatio: "4 / 3" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Training overlay */}
        {step === "training" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/85 backdrop-blur-sm">
            <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-5" />
            <p className="text-white font-bold text-lg">Entrenando modelo...</p>
            <p className="text-slate-400 text-sm mt-1.5">
              EigenFace con {captureCount} imágenes capturadas
            </p>
          </div>
        )}

        {/* Access granted banner */}
        {step === "recognizing" && accessGranted && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-green-900/95 border-2 border-green-500 rounded-xl p-3 text-center backdrop-blur-sm shadow-xl">
              <p className="text-green-300 font-black text-lg tracking-widest animate-pulse">
                ✅ ACCESO CONCEDIDO
              </p>
              <p className="text-green-400 text-sm mt-0.5">
                Identidad verificada: {visitorName}
              </p>
            </div>
          </div>
        )}

        {/* Unknown face banner */}
        {step === "recognizing" &&
          !accessGranted &&
          recognitionResults.length > 0 && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-red-900/90 border-2 border-red-600 rounded-xl p-3 text-center backdrop-blur-sm">
                <p className="text-red-300 font-bold text-lg tracking-widest">
                  ❌ IDENTIDAD NO VERIFICADA
                </p>
              </div>
            </div>
          )}

        {/* Top-left step badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider ${
              step === "capturing"
                ? "bg-blue-900/80 text-blue-300 border border-blue-700"
                : step === "recognizing"
                ? "bg-green-900/80 text-green-300 border border-green-700"
                : "bg-slate-800/80 text-slate-300 border border-slate-600"
            }`}
          >
            {step === "capturing"
              ? "● REC"
              : step === "recognizing"
              ? "● LIVE"
              : "⏳ PROCESANDO"}
          </span>
        </div>
      </div>

      {/* Status card */}
      <div className="max-w-xl mx-auto">
        {step === "capturing" && (
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-semibold text-sm">Capturando imágenes</span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  faceDetected
                    ? "bg-green-900/70 text-green-300 border border-green-700"
                    : "bg-yellow-900/70 text-yellow-300 border border-yellow-700"
                }`}
              >
                {faceDetected ? "🟢 Rostro detectado" : "🟡 Sin rostro"}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 mb-2.5">
              <div
                className="h-2.5 bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>{captureMessage}</span>
              <span className="font-mono">
                {captureCount} / {TOTAL}
              </span>
            </div>
          </div>
        )}

        {step === "training" && (
          <div className="bg-slate-800 rounded-2xl p-5 border border-blue-800/60 text-center">
            <p className="text-blue-300 font-semibold">
              Entrenando modelo EigenFace con OpenCV...
            </p>
            <p className="text-slate-400 text-sm mt-1.5">
              Esto puede tardar algunos segundos
            </p>
          </div>
        )}

        {step === "recognizing" && (
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Reconocimiento en vivo</h3>
              <button
                onClick={onCleanup}
                className="px-3 py-1.5 bg-slate-700 hover:bg-red-900/60 text-slate-300 hover:text-red-300 text-xs font-medium rounded-lg transition-colors border border-slate-600 hover:border-red-700"
              >
                🗑 Limpiar y reiniciar
              </button>
            </div>

            {employeeId && (
              <div className="flex items-center gap-3 bg-blue-900/30 border border-blue-700/60 rounded-xl px-4 py-3">
                <span className="text-blue-300 text-sm">
                  ✅ <strong>{visitorName}</strong> registrado como empleado #{employeeId}
                </span>
                <Link
                  to="/employees"
                  className="ml-auto text-xs text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2 transition-colors whitespace-nowrap"
                >
                  Completar perfil →
                </Link>
              </div>
            )}

            {recognitionResults.length === 0 ? (
              <p className="text-slate-400 text-sm">
                Posiciónate frente a la cámara para ser identificado...
              </p>
            ) : (
              <div className="space-y-2">
                {recognitionResults.map((r, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      r.name !== "Desconocido"
                        ? "bg-green-900/30 border-green-700/60"
                        : "bg-red-900/20 border-red-800/40"
                    }`}
                  >
                    <div>
                      <span className="font-mono font-bold text-white text-sm">
                        {r.name}
                      </span>
                      {r.name !== "Desconocido" && (
                        <span className="ml-2 text-xs text-green-400">AUTORIZADO</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      dist: {Math.round(r.confidence)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Demo component ─────────────────────────────────────────────────────

export default function Demo() {
  const [step, setStep] = useState("name");
  const [visitorName, setVisitorName] = useState("");
  const [captureCount, setCaptureCount] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [captureMessage, setCaptureMessage] = useState("Preparando...");
  const [recognitionResults, setRecognitionResults] = useState([]);
  const [accessGranted, setAccessGranted] = useState(false);
  const [employeeId, setEmployeeId] = useState(null);
  const [error, setError] = useState("");
  // Flag que indica que el stream ya está listo en streamRef y hay que
  // asignarlo al <video> una vez que React lo haya montado en el DOM.
  const [streamReady, setStreamReady] = useState(false);

  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);
  const sendingRef = useRef(false);

  // Capture current video frame as base64 JPEG
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const clearLoop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    sendingRef.current = false;
  }, []);

  // Draw bounding boxes on overlay canvas
  const drawOverlay = useCallback((results) => {
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!canvas || !video || !video.videoWidth) return;

    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const scaleX = rect.width / video.videoWidth;
    const scaleY = rect.height / video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    results.forEach((r) => {
      const [x, y, w, h] = r.box;
      const isKnown = r.name !== "Desconocido";
      const color = isKnown ? "#22c55e" : "#ef4444";

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY);

      // Corner accents
      const cw = w * scaleX;
      const ch = h * scaleY;
      const cornerLen = Math.min(cw, ch) * 0.15;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      const cx = x * scaleX;
      const cy = y * scaleY;
      // top-left
      ctx.beginPath(); ctx.moveTo(cx, cy + cornerLen); ctx.lineTo(cx, cy); ctx.lineTo(cx + cornerLen, cy); ctx.stroke();
      // top-right
      ctx.beginPath(); ctx.moveTo(cx + cw - cornerLen, cy); ctx.lineTo(cx + cw, cy); ctx.lineTo(cx + cw, cy + cornerLen); ctx.stroke();
      // bottom-left
      ctx.beginPath(); ctx.moveTo(cx, cy + ch - cornerLen); ctx.lineTo(cx, cy + ch); ctx.lineTo(cx + cornerLen, cy + ch); ctx.stroke();
      // bottom-right
      ctx.beginPath(); ctx.moveTo(cx + cw - cornerLen, cy + ch); ctx.lineTo(cx + cw, cy + ch); ctx.lineTo(cx + cw, cy + ch - cornerLen); ctx.stroke();

      // Name label
      ctx.font = "bold 14px monospace";
      const label = r.name.toUpperCase();
      const labelW = ctx.measureText(label).width + 12;
      ctx.fillStyle = color;
      ctx.fillRect(cx, cy - 22, labelW, 20);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, cx + 6, cy - 7);
    });
  }, []);

  // Use a ref so interval callbacks always read the latest visitorName
  const visitorNameRef = useRef(visitorName);
  useEffect(() => {
    visitorNameRef.current = visitorName;
  }, [visitorName]);

  // Start recognition loop — defined first so trainVisitor can reference it
  const startRecognizing = useCallback(() => {
    intervalRef.current = setInterval(async () => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        const frame = captureFrame();
        if (!frame) return;
        const { data } = await client.post("recognize/", {
          visitor_name: visitorNameRef.current,
          frame,
        });
        const results = data.results || [];
        setRecognitionResults(results);
        const granted = results.some((r) => r.name !== "Desconocido");
        if (granted) setAccessGranted(true);
        drawOverlay(results);
      } catch {
        // ignore
      } finally {
        sendingRef.current = false;
      }
    }, 200);
  }, [captureFrame, drawOverlay]);

  const trainVisitor = useCallback(async () => {
    setStep("training");
    try {
      const { data } = await client.post("train/", { visitor_name: visitorNameRef.current });
      if (data.employee_id) setEmployeeId(data.employee_id);
      setStep("recognizing");
      startRecognizing();
    } catch {
      setError("Error al entrenar el modelo. Inténtalo de nuevo.");
    }
  }, [startRecognizing]);

  // Start capture loop
  const startCapturing = useCallback(
    (name) => {
      setCaptureMessage("Mire directamente a la cámara...");
      intervalRef.current = setInterval(async () => {
        if (sendingRef.current) return;
        sendingRef.current = true;
        try {
          const frame = captureFrame();
          if (!frame) return;
          const { data } = await client.post("capture-frame/", {
            visitor_name: name,
            frame,
          });
          setCaptureCount(data.count);
          setFaceDetected(data.face_detected);
          if (data.face_detected) {
            setCaptureMessage(`Capturando rostro... (${data.count}/${TOTAL})`);
          } else {
            setCaptureMessage("No se detecta rostro — ajuste su posición");
          }
          if (data.count >= TOTAL) {
            clearLoop();
            trainVisitor();
          }
        } catch {
          // network/frame errors — continuar
        } finally {
          sendingRef.current = false;
        }
      }, CAPTURE_INTERVAL_MS);
    },
    [captureFrame, clearLoop, trainVisitor]
  );

  // Efecto que se ejecuta DESPUÉS de que React monta el <video> en el DOM.
  // El problema: cuando step === "camera", VideoPanel (y por tanto <video ref>)
  // todavía no está renderizado. Al hacer setStep("capturing") + setStreamReady(true)
  // en el mismo flush, React renderiza VideoPanel y luego este efecto se dispara
  // con videoRef.current ya apuntando al elemento real.
  useEffect(() => {
    if (!streamReady || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play()
      .then(() => startCapturing(visitorName))
      .catch(() => setError("Error al reproducir el video. Verifica los permisos."));
    setStreamReady(false);
  }, [streamReady, visitorName, startCapturing]);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      // Primero cambiamos el step para que React monte <VideoPanel> (y el <video>),
      // y después el useEffect de arriba asigna srcObject ya con el ref disponible.
      setStep("capturing");
      setStreamReady(true);
    } catch {
      setError("No se pudo acceder a la cámara. Verifica los permisos del navegador.");
    }
  }, []);

  const handleCleanup = useCallback(async () => {
    clearLoop();
    stopCamera();
    // Clear canvas
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }
    try {
      await client.post("cleanup/");
    } catch {
      // best effort
    }
    setStep("name");
    setVisitorName("");
    setCaptureCount(0);
    setFaceDetected(false);
    setCaptureMessage("Preparando...");
    setRecognitionResults([]);
    setAccessGranted(false);
    setEmployeeId(null);
    setError("");
  }, [clearLoop, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLoop();
      stopCamera();
    };
  }, [clearLoop, stopCamera]);

  const showVideo = ["capturing", "training", "recognizing"].includes(step);

  return (
    <div className="pt-16 min-h-screen bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Demo Interactiva
          </h1>
          <p className="text-slate-400">
            Experimento de reconocimiento facial en tiempo real con tu webcam
          </p>
        </div>

        <StepIndicator current={step} />

        <div className="mt-8">
          {error && (
            <div className="max-w-xl mx-auto bg-red-900/40 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
              ⚠️ {error}
              <button
                onClick={() => setError("")}
                className="ml-3 underline hover:text-red-200"
              >
                Cerrar
              </button>
            </div>
          )}

          {step === "name" && (
            <NameStep
              visitorName={visitorName}
              setVisitorName={setVisitorName}
              onNext={() => setStep("camera")}
            />
          )}

          {step === "camera" && <CameraStep onStart={startCamera} />}

          {showVideo && (
            <VideoPanel
              videoRef={videoRef}
              overlayCanvasRef={overlayCanvasRef}
              step={step}
              captureCount={captureCount}
              faceDetected={faceDetected}
              captureMessage={captureMessage}
              accessGranted={accessGranted}
              recognitionResults={recognitionResults}
              visitorName={visitorName}
              employeeId={employeeId}
              onCleanup={handleCleanup}
            />
          )}
        </div>

        {/* Info footer */}
        <div className="mt-12 text-center text-xs text-slate-600">
          <p>
            Las imágenes se procesan en el servidor y se eliminan automáticamente tras el entrenamiento.
          </p>
        </div>
      </div>
    </div>
  );
}
