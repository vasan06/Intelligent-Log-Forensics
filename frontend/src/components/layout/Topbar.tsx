import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Moon, Settings, ShieldAlert, Sun } from "lucide-react";
import type { User } from "../../api/types";
import { useTheme } from "../../context/ThemeContext";

interface TopbarProps { user: User; onLogout: () => void; }

const BASE_LINKS = [
  { to: "/dashboard",           label: "Dashboard" },
  { to: "/upload",              label: "Upload Logs" },
  { to: "/upload",              label: "Analyze & Live SOC" },
  { to: "/upload/history",      label: "Evidence Archive" },
  { to: "/incidents",           label: "Incidents" },
  { to: "/attack-intelligence", label: "MITRE ATT&CK" },
];

export function Topbar({ user, onLogout }: TopbarProps) {
  const [now, setNow]         = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate  = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isAdmin   = user.role === "admin";
  const initial   = (user.name || "A").charAt(0).toUpperCase();
  const links     = isAdmin ? [...BASE_LINKS, { to: "/admin", label: "Admin" }] : BASE_LINKS;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="app-topbar anim-fade-down">
      <Link to="/" className="topbar-brand">
        <div className="topbar-brand-icon"><ShieldAlert size={17} /></div>
        <div className="flex flex-col">
          <span className="topbar-brand-name">INTELLIGENT LOG FORENSICS</span>
          <span className="text-[10px] font-mono text-muted tracking-widest uppercase -mt-0.5">CYBER SOC PLATFORM</span>
        </div>
      </Link>

      <nav className="topbar-nav">
        {links.map((link, i) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `topbar-nav-link stagger-${i + 1}${isActive ? " active" : ""}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar-right">
        {/* Live SOC status beacon */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-raised border border-subtle text-xs font-mono">
          <span className="live-dot-wrap"><span className="live-dot" /></span>
          <span className="text-secondary font-medium tracking-wide">SOC ACTIVE</span>
        </div>

        {/* Digital Clock */}
        <div className="topbar-clock hidden sm:flex">
          <span className="topbar-clock-time">
            {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="topbar-clock-date">
            {now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>

        <button className="icon-btn hover-glow" aria-label="Notifications">
          <Bell size={15} />
        </button>

        {/* Theme Switcher Toggle */}
        <button
          className="icon-btn hover-glow"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode (Enterprise SIEM)" : "Switch to Dark Mode (Cyber SOC)"}
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
        </button>

        {/* User profile dropdown */}
        <div style={{ position: "relative" }}>
          <button className="topbar-user-btn" onClick={() => setMenuOpen((o) => !o)}>
            <div className="topbar-avatar">{initial}</div>
            <span className="font-semibold text-sm">{user.name}</span>
            <ChevronDown
              size={13}
              style={{
                color: "var(--text-muted)",
                transition: "transform 200ms ease",
                transform: menuOpen ? "rotate(180deg)" : "none",
              }}
            />
          </button>

          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setMenuOpen(false)} />
              <div className="dropdown-menu" style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)",
                background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)",
                minWidth: 210, zIndex: 50, overflow: "hidden", padding: "var(--sp-1)",
              }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{user.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--accent)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 2 }}>
                    ROLE: {user.role}
                  </div>
                </div>
                {isAdmin && (
                  <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate("/admin"); }}>
                    <Settings size={14} /> Administration
                  </button>
                )}
                <button className="dropdown-item" onClick={() => { toggleTheme(); }}>
                  {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />} Theme: {theme === "dark" ? "Dark SOC" : "Light SIEM"}
                </button>
                <button className="dropdown-item danger" onClick={() => { setMenuOpen(false); onLogout(); }}>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}