import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Search, ShieldCheck, Trash2, Users as UsersIcon } from "lucide-react";
import client, { errorMessage } from "../api/client";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, PageShell, Spinner, cx, inputClass, useToast } from "../components/ui";
import { ROLE_LABEL, useAuth } from "../lib/auth";

const ROLES = ["user", "admin", "superadmin"];
const ROLE_TONE = { user: "muted", admin: "info", superadmin: "warn" };
const dateFmt = (iso) => (iso ? new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

const ACTIONS = {
  login_ok: ["Inicio de sesión", "ok"],
  login_failed: ["Intento fallido", "bad"],
  login_locked: ["Cuenta bloqueada", "bad"],
  register: ["Registro", "info"],
  role_changed: ["Cambio de rol", "warn"],
  user_activated: ["Cuenta activada", "ok"],
  user_deactivated: ["Cuenta desactivada", "warn"],
  user_deleted: ["Cuenta eliminada", "bad"],
  account_deleted: ["Cuenta propia eliminada", "bad"],
  employee_deleted: ["Empleado eliminado", "bad"],
  face_enrolled: ["Rostro registrado", "ok"],
  face_deleted: ["Rostro eliminado", "warn"],
};

function UsersTab() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    client.get("users/", { params: { search: q || undefined, role: role || undefined, page_size: 100 } })
      .then((r) => setRows(r.data.results))
      .catch((e) => { toast.error(errorMessage(e)); setRows([]); });
  }, [q, role, toast]);
  useEffect(() => { load(); }, [load]);

  const patch = async (u, body, ok) => {
    try { await client.patch(`users/${u.id}/`, body); toast.success(ok); load(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
          <input className={inputClass + " pl-10"} placeholder="Buscar por email o nombre…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar cuentas" />
        </div>
        <div className="flex gap-1.5 rounded-xl border border-white/8 bg-white/3 p-1">
          {[["", "Todos"], ...ROLES.map((r) => [r, ROLE_LABEL[r]])].map(([k, l]) => (
            <button key={k} onClick={() => setRole(k)} className={cx("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", role === k ? "bg-white/12 text-white" : "text-slate-400 hover:text-white")}>{l}</button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {rows === null ? <div className="flex justify-center py-20"><Spinner className="size-8" /></div> : rows.length === 0 ? <EmptyState icon={UsersIcon} title="Sin cuentas" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs tracking-wider text-slate-500 uppercase">
                  <th className="px-5 py-3.5 font-medium">Cuenta</th><th className="px-5 py-3.5 font-medium">Rol</th>
                  <th className="px-5 py-3.5 font-medium">Estado</th><th className="px-5 py-3.5 font-medium">Último acceso</th><th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {rows.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <tr key={u.id} className="hover:bg-white/3">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3"><Avatar name={u.name} size="sm" /><div><p className="text-slate-100">{u.name}{self && <span className="ml-2 text-xs text-slate-500">(tú)</span>}</p><p className="text-xs text-slate-500">{u.email || u.username}</p></div></div>
                      </td>
                      <td className="px-5 py-3.5">
                        {self ? <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge> : (
                          <select value={u.role} onChange={(e) => patch(u, { role: e.target.value }, `Rol de ${u.name}: ${ROLE_LABEL[e.target.value]}`)} aria-label={`Rol de ${u.name}`}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white focus:border-cyan-400/60 focus:outline-none">
                            {ROLES.map((r) => <option key={r} value={r} className="bg-ink-900">{ROLE_LABEL[r]}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><div className="flex flex-wrap gap-1.5"><Badge tone={u.is_active ? "ok" : "bad"}>{u.is_active ? "Activa" : "Desactivada"}</Badge>{u.pending && <Badge tone="warn">Pendiente</Badge>}{u.has_face && <Badge tone="muted">Con rostro</Badge>}</div></td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{dateFmt(u.last_login)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {!self && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => patch(u, { is_active: !u.is_active }, u.is_active ? "Cuenta desactivada" : "Cuenta activada")}>{u.is_active ? "Desactivar" : "Activar"}</Button>
                            <Button size="sm" variant="danger" onClick={() => setToDelete(u)} aria-label={`Eliminar ${u.name}`}><Trash2 className="size-3.5" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog open={!!toDelete} loading={busy} title="Eliminar cuenta" message={`Se eliminará la cuenta de ${toDelete?.name}, su ficha y sus datos biométricos. No se puede deshacer.`}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => { setBusy(true); try { await client.delete(`users/${toDelete.id}/`); toast.success("Cuenta eliminada"); setToDelete(null); load(); } catch (e) { toast.error(errorMessage(e)); } setBusy(false); }} />
    </>
  );
}

function AuditTab() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [action, setAction] = useState("");

  useEffect(() => {
    client.get("audit/", { params: { action: action || undefined, page_size: 50 } })
      .then((r) => setRows(r.data.results))
      .catch((e) => { toast.error(errorMessage(e)); setRows([]); });
  }, [action, toast]);

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-1.5">
        {[["", "Todos"], ["login_failed", "Fallos de login"], ["login_locked", "Bloqueos"], ["role_changed", "Cambios de rol"], ["register", "Registros"], ["face_deleted", "Rostros borrados"]].map(([k, l]) => (
          <button key={k} onClick={() => { setRows(null); setAction(k); }} className={cx("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors", action === k ? "border-white/20 bg-white/12 text-white" : "border-white/8 text-slate-400 hover:text-white")}>{l}</button>
        ))}
      </div>
      <Card className="overflow-hidden">
        {rows === null ? <div className="flex justify-center py-20"><Spinner className="size-8" /></div> : rows.length === 0 ? <EmptyState icon={ClipboardList} title="Sin eventos" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-white/8 text-left text-xs tracking-wider text-slate-500 uppercase"><th className="px-5 py-3.5 font-medium">Fecha</th><th className="px-5 py-3.5 font-medium">Evento</th><th className="px-5 py-3.5 font-medium">Actor</th><th className="px-5 py-3.5 font-medium">Detalle</th><th className="px-5 py-3.5 font-medium">IP</th></tr></thead>
              <tbody className="divide-y divide-white/6">
                {rows.map((r) => {
                  const [label, tone] = ACTIONS[r.action] ?? [r.action, "muted"];
                  return (
                    <tr key={r.id} className="hover:bg-white/3">
                      <td className="px-5 py-3 text-xs whitespace-nowrap text-slate-400">{dateFmt(r.created_at)}</td>
                      <td className="px-5 py-3"><Badge tone={tone}>{label}</Badge></td>
                      <td className="px-5 py-3 text-slate-200">{r.actor_label || "—"}</td>
                      <td className="px-5 py-3 text-slate-400">{r.target || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{r.ip || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

export default function Users() {
  const [tab, setTab] = useState("users");
  return (
    <PageShell title="Cuentas y seguridad" subtitle="Gestiona roles, activa o desactiva cuentas y revisa la auditoría.">
      <div className="mb-6 inline-flex gap-1.5 rounded-xl border border-white/8 bg-white/3 p-1">
        {[["users", "Cuentas", UsersIcon], ["audit", "Auditoría", ShieldCheck]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className={cx("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors", tab === k ? "bg-white/12 text-white" : "text-slate-400 hover:text-white")}><Icon className="size-4" />{l}</button>
        ))}
      </div>
      {tab === "users" ? <UsersTab /> : <AuditTab />}
    </PageShell>
  );
}
