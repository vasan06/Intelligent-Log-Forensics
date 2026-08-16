import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, AlertCircle } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.me().then(() => navigate(next ?? "/", { replace: true })).catch(() => {});
  }, [navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(email, password);
      navigate(next ?? "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">
            <ShieldAlert size={18} />
          </div>
          <div>
            <div className="auth-logo-text">Intelligent Log Forensics</div>
            <div className="auth-logo-sub">Security Operations Console</div>
          </div>
        </div>

        <h1 style={{ fontSize: "var(--text-xl)", marginBottom: 6 }}>Sign in</h1>
        <p style={{ fontSize: "var(--text-sm)", marginBottom: 24 }}>
          Access your forensics workspace
        </p>

        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="analyst@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={14} className="alert-icon" />
              <span className="alert-text">{error}</span>
            </div>
          )}

          <Button type="submit" loading={busy} className="btn-block" style={{ marginTop: 4 }}>
            Sign in
          </Button>
        </form>

        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>
          No account?{" "}
          <Link to={`/register${next ? `?next=${next}` : ""}`} style={{ color: "var(--accent)" }}>
            Create one
          </Link>
        </p>

        <div style={{ marginTop: 20, padding: 12, background: "var(--bg-raised)", borderRadius: "var(--r-md)", fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          Demo: analyst@example.com · Analyst123!
        </div>
      </div>
    </div>
  );
}
