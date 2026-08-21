import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert, AlertCircle, Eye, EyeOff } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";

export function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^(?=.*[A-Z])(?=.*\d).{10,}$/.test(password)) {
      setError("Password must be 10+ characters with an uppercase letter and a digit."); return;
    }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true); setError(null);
    try {
      await api.register(name, email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-screen">
      {/* Animated background */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "20%", right: "15%", width: 280, height: 280, borderRadius: "50%", background: "rgba(79,70,229,.06)", filter: "blur(60px)", animation: "float 7s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "10%", width: 240, height: 240, borderRadius: "50%", background: "rgba(124,58,237,.06)", filter: "blur(50px)", animation: "float 5s ease-in-out infinite", animationDelay: "1.5s" }} />
      </div>

      <div className="auth-card anim-scale-in" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "var(--r-2xl)", overflow: "hidden", pointerEvents: "none" }}>
          <div className="scan-line" />
        </div>

        <div className="auth-logo-mark anim-fade-down" style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
          <ShieldAlert size={20} color="#fff" />
        </div>
        <h1 className="anim-fade-up" style={{ fontSize: "var(--text-xl)", marginBottom: 4 }}>Create account</h1>
        <p className="anim-fade-up stagger-1" style={{ fontSize: "var(--text-sm)", marginBottom: 24 }}>Join the forensics platform — it's free</p>

        <form className="auth-form" onSubmit={submit}>
          <div className="field anim-fade-up stagger-1">
            <label className="field-label" htmlFor="name">Full name</label>
            <input id="name" type="text" className="input" placeholder="Jane Analyst"
              value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>
          <div className="field anim-fade-up stagger-2">
            <label className="field-label" htmlFor="email">Email address</label>
            <input id="email" type="email" className="input" placeholder="jane@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field anim-fade-up stagger-3">
            <label className="field-label" htmlFor="password">Password</label>
            <div style={{ position: "relative" }}>
              <input id="password" type={showPw ? "text" : "password"} className="input"
                placeholder="Min 10 chars, uppercase + digit" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required
                style={{ paddingRight: 38 }} />
              <button type="button" onClick={() => setShowPw((s) => !s)} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2,
              }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="field anim-fade-up stagger-4">
            <label className="field-label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" className="input" placeholder="Repeat password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>

          {error && (
            <div className="alert alert-error anim-scale-in">
              <AlertCircle size={14} className="alert-icon" />
              <span className="alert-text">{error}</span>
            </div>
          )}

          <Button type="submit" loading={busy} className="btn-block hover-glow anim-fade-up stagger-5" style={{ marginTop: 4 }}>
            Create account
          </Button>
        </form>

        <p className="anim-fade-up stagger-6" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "center", marginTop: 20 }}>
          Already have an account? <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
