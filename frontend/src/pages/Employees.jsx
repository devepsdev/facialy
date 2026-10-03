import { useCallback, useEffect, useState } from "react";
import { Building2, Clock, Fingerprint, Moon, Pencil, ScanFace, Search, Trash2, UserPlus, Users, ShieldCheck, Eye } from "lucide-react";
import client, { errorMessage } from "../api/client";
import EnrollModal from "../components/EnrollModal";
import {
  Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Modal, PageShell, Spinner, inputClass, cx, useToast,
} from "../components/ui";
import { useAuth } from "../lib/auth";

const EMPTY_FORM = { first_name: "", last_name: "", email: "", department: "", schedule_entry: "", schedule_exit: "", is_active: true };
const hhmm = (t) => (t ? t.slice(0, 5) : "");
const isNight = (e) => e.schedule_entry && e.schedule_exit && e.schedule_entry > e.schedule_exit;

// ─── Formulario de alta / edición ───────────────────────────────────────────

function EmployeeForm({ employee, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() =>
    employee ? { ...EMPTY_FORM, ...employee, email: employee.email ?? "", schedule_entry: hhmm(employee.schedule_entry), schedule_exit: hhmm(employee.schedule_exit) } : EMPTY_FORM,
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      first_name: form.first_name, last_name: form.last_name, email: form.email || null, department: form.department,
      schedule_entry: form.schedule_entry || null, schedule_exit: form.schedule_exit || null, is_active: form.is_active,
    };
    try {
      const { data } = employee ? await client.patch(`employees/${employee.id}/`, payload) : await client.post("employees/", payload);
      toast.success(employee ? "Empleado actualizado" : "Empleado creado");
      onSaved(data, !employee);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object" && !data.error) setErrors(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, [].concat(v)[0]])));
      else toast.error(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={employee ? "Editar empleado" : "Nuevo empleado"} locked={saving}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre *" error={errors.first_name}><input className={inputClass} value={form.first_name} onChange={set("first_name")} required autoFocus /></Field>
          <Field label="Apellidos"><input className={inputClass} value={form.last_name} onChange={set("last_name")} /></Field>
        </div>
        <Field label="Email" error={errors.email}><input type="email" className={inputClass} value={form.email} onChange={set("email")} placeholder="nombre@empresa.com" /></Field>
        <Field label="Departamento"><input className={inputClass} value={form.department} onChange={set("department")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hora de entrada" error={errors.non_field_errors}><input type="time" className={inputClass} value={form.schedule_entry} onChange={set("schedule_entry")} /></Field>
          <Field label="Hora de salida" hint="Si la salida es anterior a la entrada se considera turno nocturno."><input type="time" className={inputClass} value={form.schedule_exit} onChange={set("schedule_exit")} /></Field>
        </div>
        <p className="text-xs text-slate-500">Sin horario, el empleado puede acceder a cualquier hora. Con horario, fuera de la franja (± 30 min) se deniega.</p>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
          <input type="checkbox" checked={form.is_active} onChange={set("is_active")} className="size-4 accent-cyan-400" /> Empleado activo
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" loading={saving}>{employee ? "Guardar cambios" : "Crear empleado"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Tarjeta ────────────────────────────────────────────────────────────────

function EmployeeCard({ e, canEdit, onEdit, onEnroll, onDelete, onRemoveFace, onApprove }) {
  return (
    <Card className={cx("flex flex-col p-5 transition-colors hover:border-white/20", !e.is_active && "opacity-70")}>
      <div className="flex items-start gap-3.5">
        <Avatar name={e.full_name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold text-white">{e.full_name}</h3>
          <p className="truncate text-sm text-slate-400">{e.email || "Sin email"}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={e.pending ? "warn" : e.is_active ? "ok" : "muted"}>{e.pending ? "Pendiente" : e.is_active ? "Activo" : "Inactivo"}</Badge>
          {e.is_demo && <Badge tone="info">Demo</Badge>}
          {e.has_account && !e.pending && <Badge tone="muted">Cuenta propia</Badge>}
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm text-slate-300">
        <div className="flex items-center gap-2.5"><Building2 className="size-4 text-slate-500" />{e.department || <span className="text-slate-500">Sin departamento</span>}</div>
        <div className="flex items-center gap-2.5">
          {isNight(e) ? <Moon className="size-4 text-violet-400" /> : <Clock className="size-4 text-slate-500" />}
          {e.schedule_entry ? <>{hhmm(e.schedule_entry)} – {hhmm(e.schedule_exit)}{isNight(e) && <span className="text-xs text-violet-300">nocturno</span>}</> : <span className="text-slate-500">Acceso 24 h</span>}
        </div>
        <div className="flex items-center gap-2.5">
          <Fingerprint className={cx("size-4", e.has_face ? "text-emerald-400" : "text-amber-400")} />
          {e.has_face ? <span className="text-emerald-300">Rostro registrado</span> : <span className="text-amber-300">Sin rostro registrado</span>}
        </div>
      </dl>

      {canEdit && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/8 pt-4">
          {e.pending && <Button size="sm" variant="success" onClick={() => onApprove(e)}><ShieldCheck className="size-3.5" /> Aprobar cuenta</Button>}
          <Button size="sm" variant={e.has_face ? "secondary" : "primary"} onClick={() => onEnroll(e)}><ScanFace className="size-3.5" /> {e.has_face ? "Re-registrar" : "Registrar rostro"}</Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(e)} aria-label="Editar"><Pencil className="size-3.5" /> Editar</Button>
          {e.has_face && <Button size="sm" variant="ghost" onClick={() => onRemoveFace(e)} title="Borrar solo los datos biométricos"><ShieldCheck className="size-3.5" /> Borrar rostro</Button>}
          <Button size="sm" variant="danger" className="ml-auto" onClick={() => onDelete(e)} aria-label="Eliminar"><Trash2 className="size-3.5" /></Button>
        </div>
      )}
    </Card>
  );
}

// ─── Página ─────────────────────────────────────────────────────────────────

const FILTERS = [
  { key: "all", label: "Todos", params: {} },
  { key: "active", label: "Activos", params: { is_active: "true" } },
  { key: "inactive", label: "Inactivos", params: { is_active: "false" } },
  { key: "noface", label: "Sin rostro", params: { has_face: "false" } },
  { key: "pending", label: "Pendientes", params: { pending: "true" } },
];

export default function Employees() {
  const toast = useToast();
  const { isAdmin: isStaff } = useAuth();
  const [items, setItems] = useState(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(null); // { type: 'form'|'enroll'|'delete'|'face', employee? }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => { setQuery(search); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    const params = { page, page_size: 12, search: query || undefined, ...FILTERS.find((f) => f.key === filter).params };
    client.get("employees/", { params })
      .then((r) => { setItems(r.data.results); setCount(r.data.count); })
      .catch((e) => { toast.error(errorMessage(e)); setItems([]); });
  }, [page, query, filter, toast]);

  useEffect(() => { load(); }, [load]);

  const confirm = async (fn, okMessage) => {
    setBusy(true);
    try { await fn(); toast.success(okMessage); setModal(null); load(); } catch (e) { toast.error(errorMessage(e)); }
    setBusy(false);
  };

  const pages = Math.max(1, Math.ceil(count / 12));

  return (
    <PageShell
      title="Empleados"
      subtitle={`${count} ${count === 1 ? "persona" : "personas"} en el sistema.`}
      actions={isStaff && <Button onClick={() => setModal({ type: "form" })}><UserPlus className="size-4" /> Nuevo empleado</Button>}
    >
      {!isStaff && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/6 px-4 py-3 text-sm text-cyan-100/90">
          <Eye className="size-4.5 shrink-0 text-cyan-300" /> Estás en modo invitado: puedes explorar los datos, pero no modificarlos.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
          <input className={inputClass + " pl-10"} placeholder="Buscar por nombre, email o departamento…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar empleados" />
        </div>
        <div className="flex gap-1.5 rounded-xl border border-white/8 bg-white/3 p-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }} className={cx("rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", filter === f.key ? "bg-white/12 text-white" : "text-slate-400 hover:text-white")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {items === null ? (
        <div className="flex justify-center py-24"><Spinner className="size-8" /></div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={Users} title={query || filter !== "all" ? "Sin resultados" : "Aún no hay empleados"} text={query || filter !== "all" ? "Prueba con otra búsqueda o filtro." : "Crea el primer empleado y registra su rostro para activar el control de acceso."}>
          {isStaff && !query && filter === "all" && <Button onClick={() => setModal({ type: "form" })}><UserPlus className="size-4" /> Nuevo empleado</Button>}
        </EmptyState></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((e) => (
            <EmployeeCard key={e.id} e={e} canEdit={isStaff}
              onEdit={(emp) => setModal({ type: "form", employee: emp })}
              onEnroll={(emp) => setModal({ type: "enroll", employee: emp })}
              onDelete={(emp) => setModal({ type: "delete", employee: emp })}
              onRemoveFace={(emp) => setModal({ type: "face", employee: emp })}
              onApprove={(emp) => confirm(() => client.patch(`employees/${emp.id}/`, { is_active: true }), `${emp.first_name} aprobado/a`)} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-slate-400">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          Página {page} de {pages}
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
        </div>
      )}

      {modal?.type === "form" && <EmployeeForm employee={modal.employee} onClose={() => setModal(null)} onSaved={(emp, created) => { setModal(created ? { type: "enroll", employee: emp } : null); load(); }} />}
      {modal?.type === "enroll" && <EnrollModal title={`Registrar rostro · ${modal.employee.first_name}`} subject={modal.employee.full_name} replacing={modal.employee.has_face} basePath={`employees/${modal.employee.id}/enroll/`} onClose={() => setModal(null)} onEnrolled={() => { setModal(null); load(); }} />}
      <ConfirmDialog open={modal?.type === "delete"} loading={busy} title="Eliminar empleado"
        message={`Se eliminará a ${modal?.employee?.full_name} junto con sus datos biométricos. Su historial de accesos se conserva como "Desconocido". Esta acción no se puede deshacer.`}
        onCancel={() => setModal(null)} onConfirm={() => confirm(() => client.delete(`employees/${modal.employee.id}/`), "Empleado eliminado")} />
      <ConfirmDialog open={modal?.type === "face"} loading={busy} title="Borrar datos biométricos" confirmLabel="Borrar rostro"
        message={`Se eliminará la huella facial de ${modal?.employee?.full_name}. Dejará de ser reconocido hasta que se registre de nuevo.`}
        onCancel={() => setModal(null)} onConfirm={() => confirm(() => client.delete(`employees/${modal.employee.id}/face/`), "Datos biométricos eliminados")} />
    </PageShell>
  );
}
