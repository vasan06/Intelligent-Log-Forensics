import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Settings, ShieldAlert } from "lucide-react";
import type { User } from "../../api/types";

interface TopbarProps { user: User; onLogout: () => void; }

const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/upload", label: "Upload Logs" },
  { to: "/incidents", label: "Incidents" },
  { to: "/attack-intelligence", label: "MITRE ATT&CK" },
];

export function Topbar({ user, onLogout }: TopbarProps) {
  const [now, setNow] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = user.role === "admin";
  const initial = (user.name || "A").charAt(0).toUpperCase();
  const links = isAdmin ? [...NAV_LINKS, { to: "/admin", label: "Settings" }] : NAV_LINKS;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="app-topbar anim-fade-down">
      <Link to="/" className="topbar-brand">
        <div className="topbar-brand-icon">
          <ShieldAlert size={16} />
        </div>
        <span className="topbar-brand-name">Intelligent Log Forensics</span>
      </Link>

      <nav className="topbar-nav">
        {links.map((link, i) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `topbar-nav-link stagger-${i + 1}${isActive ? " active" : ""}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="topbar-right">
        <div className="topbar-clock">
          <span className="topbar-clock-time">
            {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className="topbar-clock-date">
            {now.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}
          </span>
        </div>

        <button className="icon-btn hover-glow" aria-label="Notifications">
          <Bell size={15} />
        </button>

        <div style={{ position: "relative" }}>
          <button className="topbar-user-btn" onClick={() => setMenuOpen((o) => !o)}>
            <div className="topbar-avatar">{initial}</div>
            <span>{user.name}</span>
            <ChevronDown
              size={13}
              style={{ color: "var(--text-muted)", transition: "transform 200ms ease", transform: menuOpen ? "rotate(180deg)" : "none" }}
            />
          </button>

          {menuOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setMenuOpen(false)} />
              <div className="dropdown-menu" style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                background: "var(--bg-surface)", border: "1px solid var(--border-default)",
                borderRadius: "var(--r-xl)", boxShadow: "var(--shadow-lg)",
                minWidth: 186, zIndex: 50, overflow: "hidden", padding: "var(--sp-1)",
              }}>
                <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{user.name}</div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>{user.role}</div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/admin"); }}
                    className="dropdown-item"
                  >
                    <Settings size={13} /> Administration
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); onLogout(); }}
                  className="dropdown-item danger"
                >
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
