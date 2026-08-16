import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, AlertCircle } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";

export function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^(?=.*[A-Z])(?=.*\d).{10,}$/.test(password)) {
      setError("Password must be 10+ characters with an uppercase letter and a digit.");
      return;
    }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    setError(null);
    try {
      await api.register(name, email, password);
      navigate(next ?? "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark"><ShieldAlert size={18} /></div>
          <div>
            <div className="auth-logo-text">Intelligent Log Forensics</div>
            <div className="auth-logo-sub">Security Operations Console</div>
          </div>
        </div>

        <h1 style={{ fontSize: "var(--text-xl)", marginBottom: 6 }}>Create account</h1>
        <p style={{ fontSize: "var(--text-sm)", marginBottom: 24 }}>Join your forensics workspace</p>

        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label className="field-label" htmlFor="name">Full name</label>
            <input id="name" type="text" className="input" placeholder="Jane Analyst" value={name}
              onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="email">Email address</label>
            <input id="email" type="email" className="input" placeholder="jane@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" placeholder="10+ chars, uppercase, digit" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" className="input" placeholder="Repeat password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={14} className="alert-icon" />
              <span className="alert-text">{error}</span>
            </div>
          )}

          <Button type="submit" loading={busy} className="btn-block" style={{ marginTop: 4 }}>
            Create account
          </Button>
        </form>

        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>
          Already have an account?{" "}
          <Link to={`/login${next ? `?next=${next}` : ""}`} style={{ color: "var(--accent)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
