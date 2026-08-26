import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Activity, Cpu, Database, FileText, Search, ShieldAlert } from "lucide-react";
import { useInView } from "../hooks/useInView";

const FEATURES = [
  { icon: <Search size={20} />, title: "Smart Log Analysis", desc: "Parse, normalize and extract insights from CSV, JSON, TXT, LOG, and EVTX sources automatically." },
  { icon: <Cpu size={20} />, title: "ML Threat Detection", desc: "Ensemble models (IForest, OCSVM, LOF) detect anomalies and risky behaviour without signatures." },
  { icon: <ShieldAlert size={20} />, title: "MITRE ATT&CK Mapping", desc: "Every risk event is mapped to a MITRE ATT&CK tactic and technique for structured investigation." },
  { icon: <FileText size={20} />, title: "Forensic PDF Reports", desc: "Court-ready reports with SHA-256 chain-of-custody, trust scores, and incident timelines." },
  { icon: <Activity size={20} />, title: "Live SOC Feed", desc: "Stream synthetic traffic through the full detection pipeline in four scenario modes." },
  { icon: <Database size={20} />, title: "Incident Correlation", desc: "Reconstruct multi-stage attack chains from individual anomalies with full timeline analysis." },
];

const STATS = [
  { label: "Total Logs Processed", value: 125842, color: "#4f46e5" },
  { label: "Risky Events",          value: 2341,   color: "#ea580c" },
  { label: "Incidents Detected",    value: 28,     color: "#dc2626" },
  { label: "Anomalies Found",       value: 312,    color: "#16a34a" },
];

const NAV_LINKS = ["Overview", "Features", "How It Works", "Deployment", "About"];

function AnimNum({ target }: { target: number }) {
  const { ref, visible } = useInView();
  const [val, setVal] = useState(0);
  const frame = useRef<number>(0);
  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1400, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [visible, target]);
  return <span ref={ref}>{val.toLocaleString()}</span>;
}

export function Landing() {
  const featRef = useInView();
  const ctaRef  = useInView();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <header className="app-topbar anim-fade-down">
        <Link to="/" className="topbar-brand">
          <div className="topbar-brand-icon"><ShieldAlert size={16} /></div>
          <span className="topbar-brand-name">Intelligent Log Forensics</span>
        </Link>
        <nav className="topbar-nav">
          {NAV_LINKS.map((l, i) => (
            <a key={l} href="#features" className={`topbar-nav-link stagger-${i + 1}`}>{l}</a>
          ))}
        </nav>
        <div className="topbar-right">
          <Link to="/login"    className="btn btn-secondary btn-sm">Login</Link>
          <Link to="/register" className="btn btn-primary  btn-sm hover-glow">Get Started</Link>
        </div>
      </header>

      <section style={{ background: "linear-gradient(160deg,#f8f9ff 0%,#eef0fb 60%,#f0f2f5 100%)", padding: "52px 24px 40px", textAlign: "center" }}>
        <div className="anim-fade-down" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".12em", marginBottom: 14 }}>
          ✦ Cybersecurity SIEM &amp; Log Forensics Platform
        </div>
        <h1 className="anim-fade-up" style={{ fontSize: "clamp(28px,5vw,50px)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.1, marginBottom: 16 }}>
          Detect, Investigate &amp; Respond<br />
          <span className="hero-gradient-text">to Log-Based Threats</span>
        </h1>
        <p className="anim-fade-up stagger-2" style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.7 }}>
          Upload raw log evidence, run ML-powered anomaly detection, map findings to MITRE ATT&amp;CK,
          and generate chain-of-custody forensic reports — all in one self-hosted platform.
        </p>
        <div className="anim-fade-up stagger-3" style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
          <Link to="/register" className="btn btn-primary btn-lg hover-glow">
            Get Started Free <span className="animate-bounce-x"><ArrowRight size={15} /></span>
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">Sign In</Link>
        </div>

        <div className="anim-scale-in stagger-3" style={{ margin: "0 auto", maxWidth: 760, background: "#fff", border: "1px solid var(--border-default)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px rgba(79,70,229,.12),0 4px 12px rgba(0,0,0,.07)" }}>
          <div style={{ background: "var(--bg-raised)", borderBottom: "1px solid var(--border-subtle)", padding: "8px 14px", display: "flex", gap: 6, alignItems: "center" }}>
            {["#f87171","#fbbf24","#4ade80"].map((c) => <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />)}
            <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>Intelligent Log Forensics — Live Dashboard</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, padding: 14 }}>
            {STATS.map((s, i) => (
              <div key={s.label} className={`anim-fade-up stagger-${i + 2}`} style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: "-.02em" }}><AnimNum target={s.value} /></div>
                <div style={{ fontSize: 9, color: "var(--ok)", marginTop: 4 }}>↑ from last 7 days</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {["Risk Level Distribution", "Events Over Time"].map((title) => (
              <div key={title} style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>{title}</div>
                <div style={{ height: 48, display: "flex", alignItems: "flex-end", gap: 3 }}>
                  {[0.4,0.7,0.5,0.9,0.6,0.8,0.5,0.95,0.7,0.85,0.6,0.75].map((h, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: "2px 2px 0 0", background: `rgba(79,70,229,${h * 0.7})`, height: `${h * 100}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" style={{ padding: "52px 24px", maxWidth: 960, margin: "0 auto" }}>
        <div ref={featRef.ref} style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 className={featRef.visible ? "anim-fade-up" : ""} style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Complete log forensics in one platform</h2>
          <p className={featRef.visible ? "anim-fade-up stagger-1" : ""} style={{ fontSize: 14, color: "var(--text-secondary)" }}>Everything a security analyst needs from ingestion to incident report</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`feature-card hover-lift${featRef.visible ? ` anim-fade-up stagger-${i + 1}` : ""}`}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={ctaRef.ref} style={{ background: "var(--accent)", padding: "48px 24px", textAlign: "center" }}>
        <h2 className={ctaRef.visible ? "anim-fade-up" : ""} style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10 }}>Ready to investigate your logs?</h2>
        <p className={ctaRef.visible ? "anim-fade-up stagger-1" : ""} style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginBottom: 24 }}>Self-hosted, open source. Deploy with one Docker command.</p>
        <div className={`flex gap-3 justify-center flex-wrap${ctaRef.visible ? " anim-fade-up stagger-2" : ""}`}>
          <Link to="/register" className="btn btn-lg hover-glow" style={{ background: "#fff", color: "var(--accent)", border: "none" }}>Get Started Free <ArrowRight size={15} /></Link>
          <Link to="/login" className="btn btn-lg" style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)" }}>Sign In</Link>
        </div>
      </section>

      <footer style={{ padding: "var(--sp-5)", textAlign: "center", borderTop: "1px solid var(--border-subtle)", fontSize: 11, color: "var(--text-muted)" }}>
        © 2026 Intelligent Log Forensics · MIT License · Self-hosted &amp; open source
      </footer>
    </div>
  );
}