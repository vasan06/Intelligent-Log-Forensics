import { useCallback, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { User } from "../../api/types";
import { api } from "../../api/client";
import { useApi } from "../../hooks/useApi";
import { useLiveStream } from "../../hooks/useLiveStream";
import { useToast } from "../ui/Toast";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Skeleton } from "../ui/Skeleton";

const TITLES: [RegExp, string][] = [
  [/^\/upload\/history/, "Evidence Archive"],
  [/^\/upload$/, "Analyze Evidence"],
  [/^\/logs\//, "Evidence Explorer"],
  [/^\/incidents/, "Incident Tracker"],
  [/^\/reports\//, "Forensic Report"],
  [/^\/attack-intelligence\//, "Attack Detail"],
  [/^\/attack-intelligence/, "Attack Library"],
  [/^\/admin/, "Administration"],
  [/^\/$/, "Dashboard"],
];

function titleFor(pathname: string): string {
  for (const [re, title] of TITLES) {
    if (re.test(pathname)) return title;
  }
  return "Console";
}

export function AppShell() {
  const { data: user, loading, error } = useApi(() => api.me());
  const location = useLocation();
  const toast = useToast();
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [logoff, setLogoff] = useState(false);
  const [liveActive, setLiveActive] = useState(false);

  // Rate-limited toasts: only show every 5s
  const lastToast = useState(0);
  useLiveStream((event) => {
    setLiveActive(true);
    const now = Date.now();
    if (now - lastToast[0] > 5000) {
      toast(`${event.severity ?? "New"} signal · ${event.category}`, "info");
      lastToast[1](now);
    }
  });

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* already gone */ }
    setLogoff(true);
  }, []);

  if (logoff) return <Navigate to="/login" replace />;

  if (loading && !localUser) {
    return (
      <div className="app-shell">
        <div className="app-sidebar">
          <div style={{ padding: 20, borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="skeleton skeleton-line" style={{ width: "70%" }} />
          </div>
        </div>
        <div className="app-main">
          <div className="app-topbar" />
          <div className="app-content">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stat-card"><Skeleton /></div>
              ))}
            </div>
            <Skeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error && !localUser) return <Navigate to="/login" replace />;

  const activeUser = localUser ?? user;
  if (!activeUser) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar user={activeUser} onLogout={logout} liveActive={liveActive} />
      <div className="app-main">
        <Topbar title={titleFor(location.pathname)} user={activeUser} />
        <main className="app-content">
          <Outlet context={{ user: activeUser, setUser: setLocalUser }} />
        </main>
      </div>
    </div>
  );
}
