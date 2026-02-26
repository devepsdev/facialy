import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import AccessLogs from "./pages/AccessLogs";

function App() {
  return (
    <BrowserRouter basename="/facialy">
      <nav>
        <Link to="/">Dashboard</Link> |<Link to="/employees">Empleados</Link> |
        <Link to="/access-logs">Accesos</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/access-logs" element={<AccessLogs />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
