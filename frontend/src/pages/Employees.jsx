// src/pages/Employees.jsx
import { useState, useEffect } from "react";
import client from "../api/client";

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    department: "",
    schedule_entry: "09:00",
    schedule_exit: "18:00",
  });

  const loadEmployees = () => {
    client
      .get("employees/")
      .then((res) => setEmployees(res.data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    client
      .post("employees/", form)
      .then(() => {
        loadEmployees();
        setForm({
          first_name: "",
          last_name: "",
          email: "",
          department: "",
          schedule_entry: "09:00",
          schedule_exit: "18:00",
        });
      })
      .catch((err) => console.error(err));
  };

  const handleDelete = (id) => {
    client
      .delete(`employees/${id}/`)
      .then(() => loadEmployees())
      .catch((err) => console.error(err));
  };

  return (
    <div>
      <h1>Empleados</h1>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Nombre"
          value={form.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          required
        />
        <input
          placeholder="Apellido"
          value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          required
        />
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          placeholder="Departamento"
          value={form.department}
          onChange={(e) => setForm({ ...form, department: e.target.value })}
          required
        />
        <input
          type="time"
          value={form.schedule_entry}
          onChange={(e) => setForm({ ...form, schedule_entry: e.target.value })}
          required
        />
        <input
          type="time"
          value={form.schedule_exit}
          onChange={(e) => setForm({ ...form, schedule_exit: e.target.value })}
          required
        />
        <button type="submit">Añadir empleado</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>Email</th>
            <th>Departamento</th>
            <th>Horario</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.first_name}</td>
              <td>{emp.last_name}</td>
              <td>{emp.email}</td>
              <td>{emp.department}</td>
              <td>
                {emp.schedule_entry} - {emp.schedule_exit}
              </td>
              <td>
                <button onClick={() => handleDelete(emp.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Employees;
