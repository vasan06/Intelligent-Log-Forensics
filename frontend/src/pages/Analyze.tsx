import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Cpu,
  FileUp, Loader2, Play, Radio, Square, UploadCloud, Zap, ShieldAlert, Layers, ShieldCheck
  FileUp, Loader2, Play, Radio, Square, UploadCloud, Zap, Layers
} from "lucide-react";
import { api, formatTime } from "../api/client";
import type { GeneratorStatus } from "../api/types";
import { useApi } from "../hooks/useApi";
import { Badge, statusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";

const PIPELINE = [
  { name: "Validate", desc: "Format & SHA-256" },
  { name: "Parse", desc: "Syntax tokenization" },
  { name: "Normalize", desc: "Canonical schema" },
  { name: "Features", desc: "Vector extraction" },
  { name: "Rules + PyOD", desc: "Ensemble scoring" },
  { name: "MITRE Map", desc: "ATT&CK tagging" },
  { name: "Incidents", desc: "Attack chains" },
];

const MODES = [
  { id: "normal",     name: "Normal Traffic",     desc: "Standard background HTTP & API requests" },
  { id: "scan",       name: "Reconnaissance",     desc: "Automated route & endpoint probing bursts" },
  { id: "bruteforce", name: "Brute Force Attack", desc: "Credential stuffing & rapid 401 bursts" },
  { id: "breach",     name: "Breach Simulation",  desc: "Multi-stage attack chain with exfiltration" },
];

export function Analyze() {
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const config = useApi(() => api.config());
  const [status, setStatus] = useGenerator();
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState("scan");

  useEffect(() => {
    if (!busy || phase >= PIPELINE.length) return;
    const delay = phase === 4 ? 320 : 380;
    const t = setTimeout(() => setPhase((p) => p + 1), delay);
    return () => clearTimeout(t);
  }, [busy, phase]);

  async function upload(f: File) {
    setBusy(true); setPhase(0); setError(null);
    try {
      const result = await api.uploadFile(f);
      setPhase(PIPELINE.length);
      toast(`Forensic analysis complete · ${result.file_name}`, "success");
      setTimeout(() => navigate(`/logs/${result.id}`), 600);
    } catch (err) {
      setBusy(false); setPhase(-1);
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      toast(msg, "error");
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && !busy) { setFile(f); upload(f); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const maxMb = config.data?.max_upload_mb ?? 100;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right flex items-center gap-2">
            <Zap size={22} className="text-accent" />
            <span>Forensic Evidence Intake &amp; Live SOC</span>
          </h1>
          <p className="anim-fade-right stagger-1">
            Ingest multi-format security logs or stream real-time synthetic threat telemetry.
          </p>
        </div>
        <Badge tone="info" dot={false} className="anim-fade-left">
          Ingestion Limit: {maxMb} MB
        </Badge>
      </div>

      {/* Automated Pipeline Progress Stepper */}
      <div className="pipeline-steps anim-fade-up">
        {PIPELINE.map((st, i) => (
          <div key={st.name} className="flex items-center gap-1">
            <div className={`pipeline-step ${phase === i ? "active" : phase > i ? "done" : ""}`}>
              {phase > i ? (
                <CheckCircle2 size={13} className="text-ok" />
              ) : phase === i ? (
                <Loader2 size={13} className="animate-spin text-accent" />
              ) : (
                <Cpu size={13} />
              )}
              <div className="flex flex-col">
                <span className="leading-tight">{st.name}</span>
              </div>
            </div>
            {i < PIPELINE.length - 1 && <span className="pipeline-arrow">›</span>}
          </div>
        ))}
      </div>

      {/* Main Grid: Upload Dropzone + Live SOC Simulator */}
      <div className="grid-2">
        {/* Upload Station */}
        <Card title={<><FileUp size={15} /> Evidence Dropzone</>} animate delay={0}>
          <input
            ref={inputRef}
            type="file"
            accept=".log,.txt,.csv,.json,.jsonl,.evtx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) { setFile(f); upload(f); }
            }}
          />
          <div
            className={`dropzone${drag ? " drag" : ""}${busy ? " busy" : ""}`}
            onClick={() => !busy && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            aria-label="Upload log file"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent-subtle text-accent flex items-center justify-center mb-1 shadow-sm">
              <UploadCloud size={28} />
            </div>

            {file ? (
              <div className="dropzone-file bg-raised px-3 py-1 rounded-full border border-accent-border">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            ) : null}

            <div className="dropzone-title text-base sm:text-lg">
              {busy ? "Running Forensic Pipeline…" : "Drag & Drop Log Evidence Here"}
            </div>

            <p className="dropzone-hint text-xs">or click anywhere to select from file browser</p>

            {!busy && (
              <button
                className="btn btn-primary btn-sm hover-glow mt-1"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              >
                Browse Files
              </button>
            )}

            <div className="text-[11px] font-mono text-muted mt-2">
              Supported: CSV · JSON · JSONL · LOG · TXT · EVTX
            </div>
          </div>

          {error && (
            <div className="alert alert-error mt-4">
              <AlertTriangle size={14} className="alert-icon" />
              <span className="alert-text">{error}</span>
            </div>
          )}
        </Card>

        {/* Live SOC Feed Generator */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Radio size={15} className="text-accent" />
              <span>Live SOC Threat Generator</span>
            </div>
          }
          actions={
            <Badge tone={status?.running ? "ok" : "default"}>
              {status?.running ? "STREAMING" : "IDLE"}
            </Badge>
          }
          animate delay={60}
        >
          <div className="flex-col gap-4">
            <p className="text-xs text-secondary leading-relaxed">
              Generate real-time synthetic security telemetry directly into PostgreSQL and trigger live ML ensemble scoring.
            </p>

            <div className="mode-grid">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={`mode-btn${mode === m.id ? " selected" : ""}`}
                  onClick={() => setMode(m.id)}
                  disabled={!!status?.running}
                >
                  <span className="mode-btn-name">{m.name}</span>
                  <span className="mode-btn-desc">{m.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 items-center pt-2">
              {status?.running ? (
                <Button variant="danger" icon={<Square size={13} />} onClick={() => stopFeed(setStatus, toast)}>
                  Halt Feed Stream
                </Button>
              ) : (
                <Button icon={<Play size={13} />} onClick={() => startFeed(mode, setStatus, toast)}>
                  Start Streaming Signals
                </Button>
              )}

              {status?.last_error && (
                <span className="mono text-xs text-critical">
                  {status.last_error}
                </span>
              )}
            </div>

            {status && (
              <div className="kv-list pt-3 border-t border-subtle">
                <div className="kv-item"><span className="kv-key">Active Mode</span><span className="kv-value font-mono font-bold text-accent">{status.mode || "Idle"}</span></div>
                <div className="kv-item"><span className="kv-key">Activity Status</span><span className="kv-value">{status.activity}</span></div>
                <div className="kv-item"><span className="kv-key">Telemetry Source</span><span className="kv-value font-mono text-xs">{status.source?.name ?? "Web / Auth"}</span></div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Uploaded Evidence Files Summary */}
      <Card
        title={<><Layers size={15} /> Active Evidence Ingestion Log</>}
        actions={<Link className="btn btn-ghost btn-sm" to="/upload/history">Evidence Archive <ArrowRight size={12} /></Link>}
        animate delay={100}
      >
        <UploadSummaryPanel />
      </Card>
    </div>
  );
}

function UploadSummaryPanel() {
  const navigate = useNavigate();
  const uploads = useApi(() => api.uploads(8));

  if (uploads.loading) return (
    <div className="p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ marginBottom: 10 }} />
      ))}
    </div>
  );

  if (!uploads.data || uploads.data.length === 0) {
    return (
      <EmptyState
        title="No evidence files uploaded yet"
        hint="Use the dropzone above to ingest your first security log."
        icon={<FileUp size={32} strokeWidth={1.4} />}
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Evidence File</th>
            <th>Size</th>
            <th>Type</th>
            <th>Records</th>
            <th>Upload Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {uploads.data.map((row) => (
            <tr key={row.id}>
              <td className="font-semibold text-primary">{row.file_name}</td>
              <td className="dim mono text-xs">{formatSize(row.file_size)}</td>
              <td><Badge tone="default" dot={false}>{row.file_type.toUpperCase()}</Badge></td>
              <td className="mono font-semibold">{row.total_records.toLocaleString()}</td>
              <td className="dim mono text-xs">{formatTime(row.upload_time)}</td>
              <td>{statusBadge(row.processing_status)}</td>
              <td>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ArrowRight size={13} />}
                  onClick={() => navigate(`/logs/${row.id}`)}
                >
                  Analyze
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useGenerator() {
  const [status, setStatus] = useState<GeneratorStatus | null>(null);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const d = await api.generatorStatus();
        if (active) setStatus(d);
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 6000);
    return () => { active = false; clearInterval(t); };
  }, []);
  return [status, setStatus] as const;
}

async function startFeed(
  mode: string,
  set: React.Dispatch<React.SetStateAction<GeneratorStatus | null>>,
  toast: (msg: string, kind?: "success" | "error" | "info" | "warning") => void,
) {
  try {
    const r = await api.generatorStart(mode);
    set((p) => p ? { ...p, running: true, mode: r.mode, last_error: null } : null);
    toast(`Live SOC stream started · ${r.mode} mode`, "success");
  } catch (err) {
    toast(err instanceof Error ? err.message : "Failed to start feed", "error");
  }
}

async function stopFeed(
  set: React.Dispatch<React.SetStateAction<GeneratorStatus | null>>,
  toast: (msg: string, kind?: "success" | "error" | "info" | "warning") => void,
) {
  try {
    await api.generatorStop();
    set((p) => p ? { ...p, running: false } : null);
    toast("Live SOC stream halted", "info");
  } catch (err) {
    toast(err instanceof Error ? err.message : "Failed to stop feed", "error");
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}
