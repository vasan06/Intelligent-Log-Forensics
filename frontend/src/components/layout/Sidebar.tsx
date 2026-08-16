import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Upload, FolderOpen, ShieldAlert, Crosshair, Settings, LogOut, Radio,
} from "lucide-react";
import type { User } from "../../api/types";

interface SidebarProps {
  user: User;
  onLogout: () => void;
  liveActive?: boolean;
}

const NAV = [
  {
    section: "Operations",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/upload", label: "Analyze Evidence", icon: Upload },
      { to: "/upload/history", label: "Evidence Archive", icon: FolderOpen },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { to: "/incidents", label: "Incident Tracker", icon: ShieldAlert },
      { to: "/attack-intelligence", label: "Attack Library", icon: Crosshair },
    ],
  },
];

export function Sidebar({ user, onLogout, liveActive = false }: SidebarProps) {
  const initial = (user.name || "A").charAt(0).toUpperCase();
  const isAdmin = user.role === "admin";

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <ShieldAlert size={16} />
        </div>
        <div>
          <div className="sidebar-brand-name">Log Forensics</div>
          <div className="sidebar-brand-sub">v2 · Console</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="sidebar-section-label">{group.section}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              >
                <item.icon size={15} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        {isAdmin && (
          <div>
            <div className="sidebar-section-label">System</div>
            <NavLink to="/admin" className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
              <Settings size={15} />
              <span>Administration</span>
            </NavLink>
          </div>
        )}

        {liveActive && (
          <div style={{ padding: "8px 12px", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ok)" }}>
              <Radio size={12} />
              <span>Live feed active</span>
              <span className="live-dot" style={{ marginLeft: "auto" }} />
            </div>
          </div>
        )}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-avatar">{initial}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user.name}</div>
          <div className="sidebar-user-role">{user.role}</div>
        </div>
        <button
          className="btn btn-ghost btn-icon"
          style={{ flexShrink: 0 }}
          onClick={onLogout}
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
