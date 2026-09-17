import { useCallback, useRef, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useLiveStream } from "../../hooks/useLiveStream";
import { useToast } from "../ui/Toast";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const { data: user, loading, error } = useApi(() => api.me());
  const toast = useToast();
  const [logoff, setLogoff] = useState(false);

  // Throttle toast notifications from the live stream
  const lastToastRef = useRef(0);
  const { connected } = useLiveStream((event) => {
    const now = Date.now();
    if (now - lastToastRef.current > 8000) {
      lastToastRef.current = now;
      const sev = event.severity ?? "Signal";
      toast(`${sev} · ${event.category}`, sev === "Critical" ? "error" : sev === "High" ? "warning" : "info");
    }
  });

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setLogoff(true);
  }, []);

  if (logoff) return <Navigate to="/login" replace />;

  if (loading) return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark" />
          <div>
            <div className="skeleton skeleton-line" style={{ width: 100, marginBottom: 4 }} />
            <div className="skeleton skeleton-line" style={{ width: 60 }} />
          </div>
        </div>
      </aside>
      <main className="app-main">
        <div className="app-content">
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-card">
                <div className="skeleton skeleton-line" style={{ width: "50%" }} />
                <div className="skeleton" style={{ height: 36, borderRadius: 6, marginTop: 10 }} />
              </div>
            ))}
          </div>
          <div className="skeleton skeleton-block" />
        </div>
      </main>
    </div>
  );

  if (error || !user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={logout} liveConnected={connected} />
      <main className="app-main">
        <div className="app-content">
          <Outlet context={{ user }} />
        </div>
      </main>
    </div>
  );
}
