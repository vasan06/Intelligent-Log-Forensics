import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, AlertCircle, Eye, EyeOff } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then(() => navigate(next ?? "/dashboard", { replace: true })).catch(() => {});
  }, [navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await api.login(email, password);
      navigate(next ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Check your credentials.");
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-screen">
      {/* Animated background blobs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", left: "15%", width: 320, height: 320, borderRadius: "50%", background: "rgba(79,70,229,.06)", filter: "blur(60px)", animation: "float 6s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "10%", width: 280, height: 280, borderRadius: "50%", background: "rgba(124,58,237,.06)", filter: "blur(60px)", animation: "float 8s ease-in-out infinite", animationDelay: "2s" }} />
      </div>

      <div className="auth-card anim-scale-in" style={{ position: "relative", zIndex: 1 }}>
        {/* Scan line decoration */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "var(--r-2xl)", overflow: "hidden", pointerEvents: "none" }}>
          <div className="scan-line" />
        </div>

        <div className="auth-logo-mark anim-fade-down" style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
          <ShieldAlert size={20} color="#fff" />
        </div>

        <h1 className="anim-fade-up" style={{ fontSize: "var(--text-xl)", marginBottom: 4 }}>Welcome back</h1>
        <p className="anim-fade-up stagger-1" style={{ fontSize: "var(--text-sm)", marginBottom: 24 }}>
          Sign in to your forensics console
        </p>

        <form className="auth-form" onSubmit={submit}>
          <div className="field anim-fade-up stagger-2">
            <label className="field-label" htmlFor="email">Email address</label>
            <input id="email" type="email" className="input" placeholder="analyst@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field anim-fade-up stagger-3">
            <label className="field-label" htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <input id="password" type={showPw ? "text" : "password"} className="input"
                placeholder="Your password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" required
                style={{ paddingRight: 38 }}
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
                display: "flex", padding: 2,
              }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-error anim-scale-in">
              <AlertCircle size={14} className="alert-icon" />
              <span className="alert-text">{error}</span>
            </div>
          )}

          <Button type="submit" loading={busy} className="btn-block hover-glow anim-fade-up stagger-4" style={{ marginTop: 4 }}>
            Sign in
          </Button>
        </form>

        <p className="anim-fade-up stagger-5" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>
          No account? <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>Create one free</Link>
        </p>

        <div className="anim-fade-up stagger-6" style={{
          marginTop: 16, padding: "10px 14px",
          background: "var(--bg-raised)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--border-subtle)",
          fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-muted)",
        }}>
          Demo: analyst@example.com · Analyst123!
        </div>
      </div>
    </div>
  );
}
