import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Analyze } from "./pages/Analyze";
import { History } from "./pages/History";
import { EvidenceExplorer } from "./pages/EvidenceExplorer";
import { Incidents } from "./pages/Incidents";
import { ReportPreview } from "./pages/ReportPreview";
import { AttackIntelligence } from "./pages/AttackIntelligence";
import { AttackDetail } from "./pages/AttackDetail";
import { Admin } from "./pages/Admin";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Landing at "/" - public */}
      <Route path="/" element={<Landing />} />

      {/* Protected app */}
      <Route element={<AppShell />}>
        <Route path="/dashboard"                      element={<Dashboard />} />
        <Route path="/upload"                         element={<Analyze />} />
        <Route path="/upload/history"                 element={<History />} />
        <Route path="/logs/:fileId"                   element={<EvidenceExplorer />} />
        <Route path="/incidents"                      element={<Incidents />} />
        <Route path="/incidents/:fileId"              element={<Incidents />} />
        <Route path="/reports/:fileId"                element={<ReportPreview />} />
        <Route path="/attack-intelligence"            element={<AttackIntelligence />} />
        <Route path="/attack-intelligence/:slug"      element={<AttackDetail />} />
        <Route path="/admin"                          element={<Admin />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
