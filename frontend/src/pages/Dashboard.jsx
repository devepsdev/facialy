import { useState, useEffect } from "react";
import client from "../api/client";

function StatCard({ title, value, icon, borderColor }) {
  return (
    <div
      className={`bg-slate-800 rounded-2xl p-6 border ${borderColor} flex items-center gap-4`}
    >
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{title}</p>
        <p className="text-3xl font-black text-white tabular-nums">{value ?? "—"}</p>
      </div>
    </div>
  );
}

const RESULT_CONFIG = {
  GRANTED: { label: "CONCEDIDO", color: "bg-green-900/60 text-green-300 border border-green-700" },
  DENIED: { label: "DENEGADO", color: "bg-red-900/60 text-red-300 border border-red-800" },
  UNKNOWN: { label: "DESCONOCIDO", color: "bg-yellow-900/60 text-yellow-300 border border-yellow-700" },
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    client.get("dashboard/").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="pt-16 min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-slate-400">Estadísticas de accesos en tiempo real</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          <StatCard
            title="Empleados activos"
            value={stats.total_employees}
            icon="👥"
            borderColor="border-slate-600"
          />
          <StatCard
            title="Accesos hoy"
            value={stats.accesses_today}
            icon="🔓"
            borderColor="border-blue-700/60"
          />
          <StatCard
            title="Concedidos"
            value={stats.granted_today}
            icon="✅"
            borderColor="border-green-700/60"
          />
          <StatCard
            title="Denegados"
            value={stats.denied_today}
            icon="❌"
            borderColor="border-red-800/60"
          />
          <StatCard
            title="Desconocidos"
            value={stats.unknown_today}
            icon="❓"
            borderColor="border-yellow-800/60"
          />
        </div>

        {/* Recent logs table */}
        {stats.recent_logs && stats.recent_logs.length > 0 ? (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Últimos accesos</h2>
              <a
                href="/facialy/access-logs"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Ver todos →
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/40">
                  <tr>
                    {["Fecha / Hora", "Empleado / Visitante", "Resultado", "Distancia"].map(
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
                  {stats.recent_logs.map((log) => {
                    const cfg =
                      RESULT_CONFIG[log.result] || {
                        label: log.result,
                        color: "bg-slate-700 text-slate-300",
                      };
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-white">
                          {log.employee_name || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                          {Math.round(log.confidence)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-16 text-center">
            <p className="text-5xl mb-4">🔓</p>
            <p className="text-slate-400">
              No hay registros de acceso aún. Prueba la{" "}
              <a href="/facialy/demo" className="text-blue-400 hover:underline">
                Demo
              </a>{" "}
              para generar actividad.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
