import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Upload, FolderOpen, ShieldAlert,
  BookOpen, Settings, LogOut, WifiOff, Sun, Moon,
} from "lucide-react";
import type { User } from "../../api/types";
import { useTheme } from "../../context/ThemeContext";

interface SidebarProps {
  user: User;
  onLogout: () => void;
  liveConnected?: boolean;
}

const NAV_GROUPS = [
  {
    section: "Investigation",
    items: [
      { to: "/dashboard",       label: "Overview",            icon: LayoutDashboard, end: true },
      { to: "/upload",          label: "Ingest Evidence",     icon: Upload },
      { to: "/upload/history",  label: "Evidence Archive",    icon: FolderOpen },
      { to: "/incidents",       label: "Incidents",           icon: ShieldAlert },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { to: "/attack-intelligence", label: "MITRE ATT\u0026CK", icon: BookOpen },
    ],
  },
];

export function Sidebar({ user, onLogout, liveConnected = false }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const initial = (user.name || "A").charAt(0).toUpperCase();
  const isAdmin = user.role === "admin";

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">
          <ShieldAlert size={15} />
        </div>
        <div>
          <div className="sidebar-brand-name">Log Forensics</div>
          <div className="sidebar-brand-sub">Evidence Platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.section} className="sidebar-group">
            <div className="sidebar-section-label">{group.section}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
                aria-label={item.label}
              >
                <item.icon size={15} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        {isAdmin && (
          <div className="sidebar-group">
            <div className="sidebar-section-label">System</div>
            <NavLink
              to="/admin"
              className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              aria-label="Administration"
            >
              <Settings size={15} aria-hidden="true" />
              <span>Administration</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* Live stream status — truth-based */}
      <div className="sidebar-stream-status">
        {liveConnected ? (
          <div className="stream-status stream-status-connected" aria-label="Live stream connected">
            <span className="live-dot-wrap"><span className="live-dot" /></span>
            <span>Live stream</span>
          </div>
        ) : (
          <div className="stream-status stream-status-disconnected" aria-label="Live stream disconnected">
            <WifiOff size={11} aria-hidden="true" />
            <span>Stream offline</span>
          </div>
        )}
      </div>

      {/* User section */}
      <div className="sidebar-user">
        <div className="sidebar-avatar" aria-hidden="true">{initial}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user.name}</div>
          <div className="sidebar-user-role">{user.role}</div>
        </div>
        <div className="sidebar-user-actions">
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark"
              ? <Sun size={13} aria-hidden="true" />
              : <Moon size={13} aria-hidden="true" />
            }
          </button>
          <button
            className="icon-btn"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
