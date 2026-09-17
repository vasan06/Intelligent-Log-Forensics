import { Link } from "react-router-dom";
import { Activity, ArrowRight, Cpu, Database, FileText, Moon, Search, ShieldAlert, Sun, Zap } from "lucide-react";
import { useInView } from "../hooks/useInView";
import { useTheme } from "../context/ThemeContext";

const FEATURES = [
  { icon: <Search size={22} />, title: "Automated Log Ingestion", desc: "Instantly parse, normalize, and extract analytical features from CSV, JSON, TXT, LOG, and EVTX formats." },
  { icon: <Cpu size={22} />, title: "PyOD ML Anomaly Ensemble", desc: "Tri-model ensemble (Isolation Forest, One-Class SVM, LOF) uncovers zero-day anomalies without signatures." },
  { icon: <ShieldAlert size={22} />, title: "MITRE ATT&CK Mapping", desc: "Every flagged event is correlated to verified MITRE tactics and techniques for structured cyber triage." },
  { icon: <FileText size={22} />, title: "Chain-of-Custody Reports", desc: "Generate court-ready forensic PDF reports with cryptographic SHA-256 digests and trust ratings." },
  { icon: <Activity size={22} />, title: "Real-Time SOC Simulator", desc: "Stream synthetic attack telemetry across 4 scenarios: normal, reconnaissance, brute force, and breach." },
  { icon: <Database size={22} />, title: "Incident Attack Chains", desc: "Correlate isolated alerts into end-to-end multi-stage attack narratives with timeline reconstruction." },
];

const PIPELINE_STAGES = [
  { step: "01", title: "Evidence Ingestion", desc: "SHA-256 integrity hash & format validation" },
  { step: "02", title: "Normalization", desc: "Canonical event schema & data quality scoring" },
  { step: "03", title: "Dual-Engine Detection", desc: "Deterministic rules + PyOD ML ensemble" },
  { step: "04", title: "MITRE ATT&CK", desc: "Technique tagging & attack narrative mapping" },
  { step: "05", title: "Incident Correlation", desc: "Multi-stage attack chain grouping" },
  { step: "06", title: "Forensic PDF Export", desc: "Verifiable reports with chain-of-custody" },
];

export function Landing() {
  const featRef = useInView();
  const pipeRef = useInView();
  const ctaRef  = useInView();
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Topbar Navigation */}
      <header className="app-topbar anim-fade-down flex items-center justify-between px-6 py-3 border-b border-subtle bg-surface">
        <Link to="/" className="topbar-brand flex items-center gap-3 text-decoration-none">
          <div className="topbar-brand-icon w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center"><ShieldAlert size={17} /></div>
          <div className="flex flex-col">
            <span className="topbar-brand-name font-bold text-primary">INTELLIGENT LOG FORENSICS</span>
            <span className="text-[10px] font-mono text-muted tracking-widest uppercase">CYBER SOC PLATFORM</span>
          </div>
        </Link>
        <div className="topbar-right flex items-center gap-3">
          <button
            className="icon-btn hover-glow"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-indigo-600" />}
          </button>
          <Link to="/login" className="btn btn-secondary btn-sm">Sign In</Link>
          <Link to="/register" className="btn btn-primary btn-sm hover-glow">Get Started Free</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 px-6 text-center border-b border-subtle">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-subtle border border-accent-border text-xs font-mono font-semibold text-accent mb-6 anim-fade-down">
          <Zap size={12} /> ENTERPRISE SIEM &amp; FORENSIC WORKSTATION
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-primary max-w-4xl mx-auto leading-tight mb-6 anim-fade-up">
          Turn Raw Log Evidence Into <br />
          <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
            Defensible Forensic Intelligence
          </span>
        </h1>

        <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto mb-10 leading-relaxed anim-fade-up stagger-2">
          Automated multi-format log ingestion, deterministic threat rules, PyOD ML anomaly scoring,
          MITRE ATT&amp;CK narrative correlation, and chain-of-custody PDF reporting.
        </p>

        <div className="flex gap-4 justify-center flex-wrap mb-12 anim-fade-up stagger-3">
          <Link to="/register" className="btn btn-primary btn-lg hover-glow text-base px-8 py-3.5 shadow-lg">
            Launch Forensics Console <ArrowRight size={16} className="animate-bounce-x" />
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg text-base px-7 py-3.5">
            Analyst Sign In
          </Link>
        </div>
      </section>

      {/* Pipeline Progression Section */}
      <section ref={pipeRef.ref} className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-xs font-mono font-bold text-accent uppercase tracking-widest mb-2">END-TO-END PIPELINE</div>
          <h2 className="text-3xl font-extrabold text-primary">How Intelligent Log Forensics Works</h2>
          <p className="text-sm text-secondary mt-2 max-w-xl mx-auto">From raw multi-source log files to court-verifiable incident findings.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PIPELINE_STAGES.map((st, i) => (
            <div
              key={st.step}
              className={`p-6 rounded-2xl glass-card relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${pipeRef.visible ? `anim-fade-up stagger-${i+1}` : ""}`}
            >
              <div className="text-3xl font-black text-accent/20 font-mono absolute top-4 right-4">{st.step}</div>
              <div className="w-8 h-8 rounded-lg bg-accent-subtle text-accent flex items-center justify-center font-mono font-bold text-sm mb-4">
                {st.step}
              </div>
              <h3 className="text-base font-bold text-primary mb-1">{st.title}</h3>
              <p className="text-xs text-secondary leading-relaxed">{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Matrix Section */}
      <section id="features" ref={featRef.ref} className="py-20 px-6 max-w-6xl mx-auto border-t border-subtle">
        <div className="text-center mb-14">
          <div className="text-xs font-mono font-bold text-accent uppercase tracking-widest mb-2">CORE CAPABILITIES</div>
          <h2 className="text-3xl font-extrabold text-primary">Enterprise SIEM Forensics in One Platform</h2>
          <p className="text-sm text-secondary mt-2 max-w-xl mx-auto">Everything a security analyst needs to uncover attacks, evaluate risk, and prove custody.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`p-6 rounded-2xl glass-card hover-lift ${featRef.visible ? `anim-fade-up stagger-${i+1}` : ""}`}>
              <div className="w-12 h-12 rounded-xl bg-accent-subtle text-accent flex items-center justify-center mb-4 shadow-sm">
                {f.icon}
              </div>
              <h3 className="text-base font-bold text-primary mb-2">{f.title}</h3>
              <p className="text-sm text-secondary leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action Banner */}
      <section ref={ctaRef.ref} className="py-16 px-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-700 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-extrabold mb-4">Ready to Start Forensic Log Investigation?</h2>
          <p className="text-sm text-white/80 mb-8 max-w-lg mx-auto">Self-hosted, high performance, and powered by pure PostgreSQL &amp; PyOD ML.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register" className="btn btn-lg bg-white text-blue-900 font-bold hover:bg-slate-100 shadow-xl px-8">
              Create Analyst Account <ArrowRight size={15} />
            </Link>
            <Link to="/login" className="btn btn-lg bg-white/10 text-white border border-white/30 hover:bg-white/20 px-8">
              Sign In to Console
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-xs text-muted border-t border-subtle font-mono">
        © 2026 Intelligent Log Forensics · Cybersecurity SIEM &amp; Investigation Platform · PostgreSQL Engine
      </footer>
    </div>
  );
}
