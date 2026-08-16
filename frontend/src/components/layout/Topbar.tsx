import { useEffect, useState } from "react";
import type { User } from "../../api/types";

interface TopbarProps {
  title: string;
  user: User;
}

export function Topbar({ title, user }: TopbarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const clock = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <header className="app-topbar">
      <div className="topbar-breadcrumb">
        <span>Operations</span>
        <span className="topbar-sep">/</span>
        <span className="topbar-breadcrumb-current">{title}</span>
      </div>

      <div className="topbar-right">
        <div className="topbar-clock">
          <span className="topbar-clock-time">{clock}</span>
          <span className="topbar-clock-date">{date}</span>
        </div>
        <div style={{ width: 1, height: 28, background: "var(--border-subtle)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>{user.name}</span>
          <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{user.role}</span>
        </div>
      </div>
    </header>
  );
}
