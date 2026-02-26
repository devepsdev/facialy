import { useState, useEffect } from "react";
import client from "../api/client";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  department: "",
  schedule_entry: "09:00",
  schedule_exit: "18:00",
};

const INPUT_CLASS =
  "bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors text-sm w-full";

const CELL_INPUT =
  "bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500 w-full";

const isIncomplete = (emp) =>
  !emp.email || !emp.department || !emp.schedule_entry || !emp.schedule_exit;

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const load = () =>
    client
      .get("employees/")
      .then((r) => setEmployees(r.data))
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  // ── Add form ──────────────────────────────────────────────────────────────

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await client.post("employees/", form);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      const data = err.response?.data;
      if (data?.email) setFormError(`Email: ${data.email[0]}`);
      else setFormError("Error al guardar el empleado.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar a ${name}?`)) return;
    try {
      await client.delete(`employees/${id}/`);
      if (editingId === id) setEditingId(null);
      load();
    } catch {
      alert("Error al eliminar el empleado.");
    }
  };

  // ── Inline edit ───────────────────────────────────────────────────────────

  const startEdit = (emp) => {
    setEditingId(emp.id);
    setEditError("");
    setEditForm({
      first_name: emp.first_name || "",
      last_name: emp.last_name || "",
      email: emp.email || "",
      department: emp.department || "",
      schedule_entry: emp.schedule_entry || "",
      schedule_exit: emp.schedule_exit || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError("");
  };

  const handleEditChange = (field) => (e) =>
    setEditForm((prev) => ({ ...prev, [field]: e.target.value }));

  const saveEdit = async () => {
    setEditError("");
    setEditSaving(true);
    try {
      await client.patch(`employees/${editingId}/`, {
        ...editForm,
        email: editForm.email || null,
        schedule_entry: editForm.schedule_entry || null,
        schedule_exit: editForm.schedule_exit || null,
      });
      setEditingId(null);
      load();
    } catch (err) {
      const data = err.response?.data;
      if (data?.email) setEditError(`Email: ${data.email[0]}`);
      else setEditError("Error al guardar los cambios.");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="pt-16 min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Empleados</h1>
          <p className="text-slate-400">Gestión del directorio de empleados</p>
        </div>

        {/* Add form */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-8">
          <h2 className="text-base font-semibold text-white mb-5">Añadir empleado</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <input
                placeholder="Nombre *"
                value={form.first_name}
                onChange={handleChange("first_name")}
                required
                className={INPUT_CLASS}
              />
              <input
                placeholder="Apellido"
                value={form.last_name}
                onChange={handleChange("last_name")}
                className={INPUT_CLASS}
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange("email")}
                className={INPUT_CLASS}
              />
              <input
                placeholder="Departamento"
                value={form.department}
                onChange={handleChange("department")}
                className={INPUT_CLASS}
              />
              <div className="flex items-center gap-2">
                <label className="text-slate-400 text-xs whitespace-nowrap min-w-14">
                  Entrada:
                </label>
                <input
                  type="time"
                  value={form.schedule_entry}
                  onChange={handleChange("schedule_entry")}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-400 text-xs whitespace-nowrap min-w-14">
                  Salida:
                </label>
                <input
                  type="time"
                  value={form.schedule_exit}
                  onChange={handleChange("schedule_exit")}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {formError && (
              <p className="text-red-400 text-sm mb-3">⚠️ {formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {submitting ? "Guardando..." : "+ Añadir empleado"}
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Directorio</h2>
            <span className="text-slate-400 text-sm">
              {employees.length} empleado{employees.length !== 1 ? "s" : ""}
            </span>
          </div>

          {employees.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <p className="text-4xl mb-3">👥</p>
              <p>No hay empleados registrados todavía.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/40">
                  <tr>
                    {["Nombre", "Email", "Departamento", "Horario", "Estado", "Acciones"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {employees.map((emp) =>
                    editingId === emp.id ? (
                      /* ── Edit row ── */
                      <tr key={emp.id} className="bg-slate-700/30">
                        <td className="px-4 py-3" colSpan={6}>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                              <input
                                placeholder="Nombre *"
                                value={editForm.first_name}
                                onChange={handleEditChange("first_name")}
                                required
                                className={CELL_INPUT}
                              />
                              <input
                                placeholder="Apellido"
                                value={editForm.last_name}
                                onChange={handleEditChange("last_name")}
                                className={CELL_INPUT}
                              />
                              <input
                                type="email"
                                placeholder="Email"
                                value={editForm.email}
                                onChange={handleEditChange("email")}
                                className={CELL_INPUT}
                              />
                              <input
                                placeholder="Departamento"
                                value={editForm.department}
                                onChange={handleEditChange("department")}
                                className={CELL_INPUT}
                              />
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 text-xs shrink-0">In:</span>
                                <input
                                  type="time"
                                  value={editForm.schedule_entry}
                                  onChange={handleEditChange("schedule_entry")}
                                  className={CELL_INPUT}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 text-xs shrink-0">Out:</span>
                                <input
                                  type="time"
                                  value={editForm.schedule_exit}
                                  onChange={handleEditChange("schedule_exit")}
                                  className={CELL_INPUT}
                                />
                              </div>
                            </div>
                            {editError && (
                              <p className="text-red-400 text-xs">⚠️ {editError}</p>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={saveEdit}
                                disabled={editSaving || !editForm.first_name.trim()}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
                              >
                                {editSaving ? "Guardando..." : "Guardar"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs font-medium rounded-lg transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      /* ── Display row ── */
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span>
                              {emp.first_name} {emp.last_name}
                            </span>
                            {isIncomplete(emp) && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-700/50">
                                ⚠ Incompleto
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {emp.email || (
                            <span className="text-slate-600 italic">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {emp.department || (
                            <span className="text-slate-600 italic">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                          {emp.schedule_entry && emp.schedule_exit
                            ? `${emp.schedule_entry} – ${emp.schedule_exit}`
                            : <span className="text-slate-600 italic">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              emp.is_active
                                ? "bg-green-900/60 text-green-300 border border-green-700"
                                : "bg-slate-700 text-slate-400 border border-slate-600"
                            }`}
                          >
                            {emp.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => startEdit(emp)}
                              className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(emp.id, `${emp.first_name} ${emp.last_name}`)
                              }
                              className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
