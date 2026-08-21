import { useCallback, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useLiveStream } from "../../hooks/useLiveStream";
import { useToast } from "../ui/Toast";
import { Topbar } from "./Topbar";

export function AppShell() {
  const { data: user, loading, error } = useApi(() => api.me());
  const toast = useToast();
  const [logoff, setLogoff] = useState(false);
  const lastToastTime = useState(0);

  useLiveStream((event) => {
    const now = Date.now();
    if (now - lastToastTime[0] > 5000) {
      toast(`${event.severity ?? "Signal"} · ${event.category}`, "info");
      lastToastTime[1](now);
    }
  });

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setLogoff(true);
  }, []);

  if (logoff) return <Navigate to="/login" replace />;

  if (loading) return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="skeleton" style={{ width: 220, height: 28, borderRadius: 8 }} />
      </div>
      <div className="app-content">
        <div className="grid-4" style={{ marginBottom: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton skeleton-line" style={{ width: "50%" }} />
              <div className="skeleton" style={{ height: 36, borderRadius: 6, marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div className="skeleton skeleton-block" />
      </div>
    </div>
  );

  if (error || !user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Topbar user={user} onLogout={logout} />
      <main className="app-content">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}
