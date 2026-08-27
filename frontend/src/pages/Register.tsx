import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert, AlertCircle, Eye, EyeOff, User, Mail, Lock, ArrowRight, Sun, Moon } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { useTheme } from "../context/ThemeContext";

export function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { theme, toggleTheme } = useTheme();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^(?=.*[A-Z])(?=.*\d).{10,}$/.test(password)) {
      setError("Password must be 10+ characters with at least one uppercase letter and one digit.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
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
      {/* Theme Switcher in top corner */}
      <div className="absolute top-6 right-6 z-20">
        <button
          className="icon-btn hover-glow"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
        </button>
      </div>

      {/* Cyber Atmospheric Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-500/10 blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full bg-indigo-500/10 blur-[90px] animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      <div className="auth-card anim-scale-in glass-card relative z-10 shadow-2xl">
        <div className="scan-line" />

        <div className="flex items-center gap-3 mb-6">
          <div className="auth-logo-mark anim-fade-down" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))" }}>
            <ShieldAlert size={22} color="#fff" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary leading-tight">INTELLIGENT LOG FORENSICS</h2>
            <p className="text-[10px] font-mono text-muted tracking-widest uppercase">CYBER SOC PLATFORM</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-primary mb-1">Create Analyst Account</h1>
        <p className="text-xs text-secondary mb-6">Register to initialize your forensics workspace</p>

        <form className="auth-form" onSubmit={submit}>
          <div className="field anim-fade-up stagger-1">
            <label className="field-label" htmlFor="name">Full Name</label>
            <div className="input-group">
              <User size={14} className="input-group-icon" />
              <input
                id="name"
                type="text"
                className="input"
                placeholder="Jane Analyst"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="field anim-fade-up stagger-2">
            <label className="field-label" htmlFor="email">Analyst Email</label>
            <div className="input-group">
              <Mail size={14} className="input-group-icon" />
              <input
                id="email"
                type="email"
                className="input"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="field anim-fade-up stagger-3">
            <label className="field-label" htmlFor="password">Security Password</label>
            <div className="input-group">
              <Lock size={14} className="input-group-icon" />
              <input
                id="password"
                type={showPw ? "text" : "password"}
                className="input"
                placeholder="Min 10 chars, uppercase + digit"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 text-muted hover:text-primary transition-colors cursor-pointer bg-transparent border-0"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="field anim-fade-up stagger-4">
            <label className="field-label" htmlFor="confirm">Confirm Password</label>
            <div className="input-group">
              <Lock size={14} className="input-group-icon" />
              <input
                id="confirm"
                type="password"
                className="input"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-error anim-scale-in my-1">
              <AlertCircle size={14} className="alert-icon" />
              <span className="alert-text text-xs">{error}</span>
            </div>
          )}

          <Button type="submit" loading={busy} className="btn-block hover-glow anim-fade-up stagger-5 py-3 mt-2 font-bold shadow-md">
            Register Analyst <ArrowRight size={14} />
          </Button>
        </form>

        <p className="text-xs text-secondary text-center mt-6 anim-fade-up stagger-6">
          Already have an account? <Link to="/login" className="font-bold text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
