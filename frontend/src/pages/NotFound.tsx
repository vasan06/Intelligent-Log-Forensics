import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="auth-screen">
      <div className="auth-card anim-scale-in" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 80, fontWeight: 800, color: "var(--accent)", lineHeight: 1, marginBottom: 8, letterSpacing: "-.04em" }} className="anim-fade-down">
          404
        </div>
        <h2 className="anim-fade-up" style={{ marginBottom: 8 }}>Page not found</h2>
        <p className="anim-fade-up stagger-1" style={{ marginBottom: 24, fontSize: "var(--text-sm)" }}>
          The page you requested doesn't exist or has been moved.
        </p>
        <Link className="btn btn-primary hover-glow anim-fade-up stagger-2" to="/">Return home</Link>
      </div>
    </div>
  );
}
