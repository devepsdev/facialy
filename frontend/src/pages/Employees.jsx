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

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const load = () =>
    client
      .get("employees/")
      .then((r) => setEmployees(r.data))
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Eliminar a ${name}?`)) return;
    try {
      await client.delete(`employees/${id}/`);
      load();
    } catch {
      alert("Error al eliminar el empleado.");
    }
  };

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
                placeholder="Apellido *"
                value={form.last_name}
                onChange={handleChange("last_name")}
                required
                className={INPUT_CLASS}
              />
              <input
                type="email"
                placeholder="Email *"
                value={form.email}
                onChange={handleChange("email")}
                required
                className={INPUT_CLASS}
              />
              <input
                placeholder="Departamento *"
                value={form.department}
                onChange={handleChange("department")}
                required
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
                  required
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
                  required
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
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {emp.first_name} {emp.last_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {emp.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {emp.department}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                        {emp.schedule_entry} – {emp.schedule_exit}
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
                        <button
                          onClick={() =>
                            handleDelete(emp.id, `${emp.first_name} ${emp.last_name}`)
                          }
                          className="text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
