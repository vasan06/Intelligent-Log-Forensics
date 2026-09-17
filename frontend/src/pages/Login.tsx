import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, AlertCircle, Eye, EyeOff, Lock, Mail, ArrowRight, Sun, Moon } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { useTheme } from "../context/ThemeContext";

export function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { theme, toggleTheme } = useTheme();

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
      setError(err instanceof Error ? err.message : "Authentication failed. Check your credentials.");
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

      <div className="auth-card anim-scale-in glass-card relative z-10 shadow-2xl p-6 rounded-2xl border border-subtle">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-hover))" }}>
            <ShieldAlert size={22} color="#fff" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary leading-tight">INTELLIGENT LOG FORENSICS</h2>
            <p className="text-[10px] font-mono text-muted tracking-widest uppercase">CYBER SOC PLATFORM</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-primary mb-1">Analyst Authentication</h1>
        <p className="text-xs text-secondary mb-6">Sign in to access the forensics command workstation</p>

        <form className="auth-form flex flex-col gap-4" onSubmit={submit}>
          <div className="field anim-fade-up stagger-1">
            <label className="field-label" htmlFor="email">Analyst Email</label>
            <div className="input-group">
              <Mail size={14} className="input-group-icon" />
              <input
                id="email"
                type="email"
                className="input"
                placeholder="analyst@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="field anim-fade-up stagger-2">
            <label className="field-label" htmlFor="password">Security Password</label>
            <div className="input-group">
              <Lock size={14} className="input-group-icon" />
              <input
                id="password"
                type={showPw ? "text" : "password"}
                className="input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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

          {error && (
            <div className="alert alert-error anim-scale-in my-1">
              <AlertCircle size={14} className="alert-icon" />
              <span className="alert-text text-xs">{error}</span>
            </div>
          )}

          <Button type="submit" loading={busy} className="btn-block hover-glow anim-fade-up stagger-3 py-3 mt-2 font-bold shadow-md">
            Sign In to Console <ArrowRight size={14} />
          </Button>
        </form>

        <p className="text-xs text-secondary text-center mt-6 anim-fade-up stagger-4">
          Need an account? <Link to="/register" className="font-bold text-accent hover:underline">Register analyst</Link>
        </p>
      </div>
    </div>
  );
}
