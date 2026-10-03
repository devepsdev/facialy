import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Fingerprint, Hourglass, ScanFace, ShieldCheck, ShieldX, Trash2, UserCheck } from "lucide-react";
import client, { errorMessage } from "../api/client";
import EnrollModal from "../components/EnrollModal";
import FaceCamera from "../components/FaceCamera";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, PageLoader, PageShell, REASON_LABEL, ResultBadge, cx, useToast } from "../components/ui";
import useCamera from "../hooks/useCamera";
import { useLoop } from "../hooks/useEffects";
import { ROLE_LABEL, useAuth } from "../lib/auth";

const timeFmt = (iso) => new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Verificación 1:1 en vivo: ¿quien está frente a la cámara es el titular de esta cuenta? */
function VerifyPanel({ onVerified, pending }) {
  const camera = useCamera();
  const [active, setActive] = useState(false);
  const [state, setState] = useState(null);

  const start = async () => {
    if (await camera.start()) setActive(true);
  };
  const stop = () => {
    setActive(false);
    camera.stop();
    setState(null);
  };

  useLoop(
    async () => {
      const frame = camera.grab(0.7);
      if (!frame) return;
      const { data } = await client.post("me/verify/", { frame });
      setState(data);
      if (data.logged) onVerified?.();
    },
    active,
    400,
  );

  const face = state?.face ? [{ box: state.face, tone: state.verified ? "ok" : "bad", label: state.verified ? "Eres tú" : "No coincide", sub: state.similarity?.toFixed(2) }] : [];
  const access = state?.access;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white"><UserCheck className="size-5 text-cyan-300" /> Verificar mi identidad</h2>
        {active ? <Button variant="danger" size="sm" onClick={stop}>Detener</Button> : <Button size="sm" onClick={start} loading={camera.status === "requesting"}><ScanFace className="size-4" /> Iniciar</Button>}
      </div>
      <p className="mb-4 text-sm text-slate-400">Verificación 1:1: se compara solo con <i>tu</i> huella, no con la de nadie más. Si coincide, se evalúan las reglas de acceso y se registra el evento.</p>

      <FaceCamera camera={camera} faces={face} scanning={active && !state?.face} idleText="Pulsa «Iniciar» para activar la cámara">
        {active && state && (
          <div className="absolute inset-x-4 bottom-4 z-10">
            <div className={cx("animate-pop rounded-2xl border px-4 py-3 text-center backdrop-blur-md", !state.face ? "border-white/15 bg-ink-950/70" : state.verified ? (access?.result === "GRANTED" ? "border-emerald-400/50 bg-emerald-950/80" : "border-amber-300/50 bg-amber-950/70") : "border-rose-400/50 bg-rose-950/80")}>
              {!state.face ? (
                <p className="text-sm text-slate-300">Colócate frente a la cámara…</p>
              ) : !state.verified ? (
                <p className="flex items-center justify-center gap-2 font-semibold text-rose-300"><ShieldX className="size-5" /> Identidad no verificada</p>
              ) : (
                <>
                  <p className="flex items-center justify-center gap-2 font-semibold text-emerald-300"><ShieldCheck className="size-5" /> Identidad verificada · similitud {state.similarity.toFixed(2)}</p>
                  <p className={cx("text-sm", access?.result === "GRANTED" ? "text-emerald-200/80" : "text-amber-200")}>
                    {access?.result === "GRANTED" ? "Acceso concedido" : `Acceso denegado: ${pending ? "cuenta pendiente de aprobación" : (REASON_LABEL[access?.reason] ?? "sin permiso")}`}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </FaceCamera>
      {state && state.enrolled === false && <p className="mt-3 text-sm text-amber-300">Primero registra tu rostro.</p>}
    </Card>
  );
}

export default function Me() {
  const toast = useToast();
  const navigate = useNavigate();
  const { logout, role } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // enroll | face | account
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    client.get("me/profile/").then((r) => setData(r.data)).catch((e) => setError(e.response?.status === 403 ? "Tu cuenta no tiene un perfil biométrico asociado." : errorMessage(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <PageShell title="Mi perfil"><EmptyState icon={Fingerprint} title="Sin perfil biométrico" text={error} /></PageShell>;
  if (!data) return <PageLoader />;

  const { employee, user, history } = data;

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setModal(null); load(); } catch (e) { toast.error(errorMessage(e)); }
    setBusy(false);
  };
  const deleteAccount = async () => {
    setBusy(true);
    try {
      await client.delete("me/profile/");
      await logout();
      toast.success("Tu cuenta y tus datos se han eliminado");
      navigate("/", { replace: true });
    } catch (e) { toast.error(errorMessage(e)); setBusy(false); }
  };

  return (
    <PageShell title="Mi perfil" subtitle="Gestiona tu huella facial y verifica tu identidad.">
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold text-white">{user.name}</p>
          <p className="text-slate-400">{user.email}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Badge tone="info">{ROLE_LABEL[role]}</Badge>
          <Badge tone={employee.pending ? "warn" : employee.is_active ? "ok" : "muted"}>{employee.pending ? "Cuenta pendiente de aprobación" : employee.is_active ? "Acceso activo" : "Inactiva"}</Badge>
        </div>
      </div>

      {employee.pending && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100/90">
          <Hourglass className="mt-0.5 size-4.5 shrink-0 text-amber-300" />
          <span>Un administrador debe aprobar tu cuenta antes de concederte acceso. Mientras tanto puedes registrar tu rostro y probar la verificación: tu identidad se confirmará, pero el acceso aparecerá como denegado.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <VerifyPanel onVerified={load} pending={employee.pending} />

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white"><Fingerprint className="size-5 text-cyan-300" /> Mi huella facial</h2>
            {employee.has_face ? (
              <p className="mb-4 text-sm text-emerald-300">Registrada el {new Date(employee.face_enrolled_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.</p>
            ) : (
              <p className="mb-4 text-sm text-amber-300">Aún no has registrado tu rostro.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setModal("enroll")}><ScanFace className="size-4" /> {employee.has_face ? "Volver a registrar" : "Registrar mi rostro"}</Button>
              {employee.has_face && <Button variant="secondary" onClick={() => setModal("face")}>Borrar mi huella</Button>}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">Solo se guarda un vector de 128 números; nunca tu foto. Puedes borrarlo en cualquier momento.</p>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-white"><Clock className="size-5 text-cyan-300" /> Mi actividad</h2>
            {history.length === 0 ? <p className="text-sm text-slate-500">Aún no hay verificaciones registradas.</p> : (
              <ul className="space-y-3">
                {history.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-300">{timeFmt(l.timestamp)}{l.reason && <span className="ml-2 text-xs text-slate-500">{REASON_LABEL[l.reason]}</span>}</span>
                    <ResultBadge result={l.result} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {role === "user" && (
            <Card className="border-rose-500/20 p-6">
              <h2 className="mb-2 font-display text-lg font-semibold text-white">Zona de privacidad</h2>
              <p className="mb-4 text-sm text-slate-400">Elimina tu cuenta, tu ficha y tus datos biométricos de forma definitiva.</p>
              <Button variant="danger" size="sm" onClick={() => setModal("account")}><Trash2 className="size-3.5" /> Eliminar mi cuenta</Button>
            </Card>
          )}
        </div>
      </div>

      {modal === "enroll" && <EnrollModal title="Registrar mi rostro" subject="tu cuenta" basePath="me/enroll/" replacing={employee.has_face} onClose={() => setModal(null)} onEnrolled={() => { setModal(null); load(); }} />}
      <ConfirmDialog open={modal === "face"} loading={busy} title="Borrar mi huella facial" confirmLabel="Borrar huella"
        message="Dejarás de poder verificar tu identidad hasta que vuelvas a registrar tu rostro." onCancel={() => setModal(null)}
        onConfirm={() => run(() => client.delete("me/face/"), "Huella facial eliminada")} />
      <ConfirmDialog open={modal === "account"} loading={busy} title="Eliminar mi cuenta" confirmLabel="Eliminar todo"
        message="Se borrarán de forma definitiva tu cuenta, tu ficha y tu huella facial. Esta acción no se puede deshacer."
        onCancel={() => setModal(null)} onConfirm={deleteAccount} />
    </PageShell>
  );
}
