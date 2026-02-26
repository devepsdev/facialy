// src/pages/AccessLogs.jsx
import { useState, useEffect } from "react";
import client from "../api/client";

function AccessLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    client
      .get("access-logs/")
      .then((res) => setLogs(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div>
      <h1>Registro de Accesos</h1>

      <table>
        <thead>
          <tr>
            <th>Fecha/Hora</th>
            <th>Empleado</th>
            <th>Resultado</th>
            <th>Confianza</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.timestamp).toLocaleString()}</td>
              <td>{log.employee_name}</td>
              <td>{log.result}</td>
              <td>{log.confidence.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AccessLogs;
