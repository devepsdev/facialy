import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Demo from "./pages/Demo";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import AccessLogs from "./pages/AccessLogs";

export default function App() {
  return (
    <BrowserRouter basename="/facialy">
      <div className="min-h-screen bg-slate-900 text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/access-logs" element={<AccessLogs />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
