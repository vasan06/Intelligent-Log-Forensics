import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export function NotFound() {
  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-logo" style={{ justifyContent: "center" }}>
          <div className="auth-logo-mark"><ShieldAlert size={18} /></div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 72, fontWeight: 700, color: "var(--text-muted)", lineHeight: 1, marginBottom: 12 }}>
          404
        </div>
        <h2 style={{ marginBottom: 8 }}>Route not found</h2>
        <p style={{ marginBottom: 24, fontSize: "var(--text-sm)" }}>
          The page you requested doesn't exist or has been moved.
        </p>
        <Link className="btn btn-primary" to="/">
          <ArrowLeft size={14} /> Return to dashboard
        </Link>
      </div>
    </div>
  );
}
