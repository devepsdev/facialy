import { useState, useEffect } from "react";
import client from "../api/client";

const RESULT_CONFIG = {
  GRANTED: {
    label: "CONCEDIDO",
    color: "bg-green-900/60 text-green-300 border border-green-700",
    icon: "✅",
  },
  DENIED: {
    label: "DENEGADO",
    color: "bg-red-900/60 text-red-300 border border-red-800",
    icon: "❌",
  },
  UNKNOWN: {
    label: "DESCONOCIDO",
    color: "bg-yellow-900/60 text-yellow-300 border border-yellow-700",
    icon: "❓",
  },
};

export default function AccessLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get("access-logs/")
      .then((r) => setLogs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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
          <h1 className="text-3xl font-bold text-white mb-1">Registro de Accesos</h1>
          <p className="text-slate-400">
            Historial completo de intentos de acceso al sistema
          </p>
        </div>

        {/* Summary badges */}
        {logs.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            {Object.entries(RESULT_CONFIG).map(([key, cfg]) => {
              const count = logs.filter((l) => l.result === key).length;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${cfg.color}`}
                >
                  <span>{cfg.icon}</span>
                  <span>
                    {count} {cfg.label.toLowerCase()}
                    {count !== 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-700 text-slate-300 border border-slate-600">
              📋 {logs.length} total
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Historial</h2>
            <span className="text-slate-400 text-sm">{logs.length} registros</span>
          </div>

          {logs.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <p className="text-5xl mb-4">🔓</p>
              <p>No hay registros de acceso aún.</p>
              <p className="mt-2 text-xs">
                Usa la{" "}
                <a href="/facialy/demo" className="text-blue-400 hover:underline">
                  Demo interactiva
                </a>{" "}
                para generar entradas en el historial.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/40">
                  <tr>
                    {[
                      "#",
                      "Fecha / Hora",
                      "Empleado / Visitante",
                      "Resultado",
                      "Distancia",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {logs.map((log, idx) => {
                    const cfg = RESULT_CONFIG[log.result] || {
                      label: log.result,
                      color: "bg-slate-700 text-slate-300",
                      icon: "—",
                    };
                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                          #{idx + 1}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                          {new Date(log.timestamp).toLocaleString("es-ES", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm text-white">
                          {log.employee_name || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}
                          >
                            {cfg.icon} {cfg.label}
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
          )}
        </div>
      </div>
    </div>
  );
}
