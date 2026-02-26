import { useState, useEffect } from "react";
import client from "../api/client";

function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    client
      .get("dashboard/")
      .then((res) => setStats(res.data))
      .catch((err) => console.error(err));
  }, []);

  if (!stats) return <p>Cargando...</p>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Empleados activos: {stats.total_employees}</p>
      <p>Accesos hoy: {stats.accesses_today}</p>
      <p>Concedidos: {stats.granted_today}</p>
      <p>Denegados: {stats.denied_today}</p>
      <p>Desconocidos: {stats.unknown_today}</p>
    </div>
  );
}

export default Dashboard;
