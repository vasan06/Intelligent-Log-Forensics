import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Cpu, FileUp, Loader2,
  Play, Radio, Square, UploadCloud,
} from "lucide-react";
import { api, formatTime } from "../api/client";
import type { GeneratorStatus } from "../api/types";
import { useApi } from "../hooks/useApi";
import { Badge, statusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";

const PIPELINE = ["Validate", "Parse", "Normalize", "Features", "Rules + ML", "MITRE Map", "Incidents"];

const MODES = [
  { id: "normal",    name: "Normal traffic",   desc: "Background web activity" },
  { id: "scan",      name: "Reconnaissance",   desc: "Route probing & discovery" },
  { id: "brute",     name: "Brute force",      desc: "Credential stuffing bursts" },
  { id: "breach",    name: "Breach scenario",  desc: "Full attack simulation" },
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
    const delay = phase === 3 ? 280 : 380;
    const t = setTimeout(() => setPhase((p) => p + 1), delay);
    return () => clearTimeout(t);
  }, [busy, phase]);

  async function upload(f: File) {
    setBusy(true); setPhase(0); setError(null);
    try {
      const result = await api.uploadFile(f);
      setPhase(PIPELINE.length);
      toast(`Analysis complete · ${result.file_name}`, "success");
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
    if (f) { setFile(f); upload(f); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const maxMb = config.data?.max_upload_mb ?? 100;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Analyze Evidence</h1>
          <p>Ingest a log file or stream a live simulated SOC feed through the detection pipeline.</p>
        </div>
        <Badge tone="info" dot={false}>Max {maxMb} MB per file</Badge>
      </div>

      {/* Pipeline progress */}
      <div className="pipeline-steps">
        {PIPELINE.map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <span className={`pipeline-step ${phase === i ? "active" : phase > i ? "done" : ""}`}>
              {phase > i ? <CheckCircle2 size={12} /> : phase === i ? <Loader2 size={12} className="animate-spin" /> : <Cpu size={12} />}
              {step}
            </span>
            {i < PIPELINE.length - 1 && <span className="pipeline-arrow">›</span>}
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Upload dropzone */}
        <Card title={<><FileUp size={14} /> Upload Evidence File</>}>
          <input
            ref={inputRef} type="file" accept=".log,.txt,.csv,.json,.jsonl"
            hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); upload(f); } }}
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
            aria-label="Upload evidence file"
          >
            <UploadCloud size={32} className="dropzone-icon" />
            {file && !busy && <div className="dropzone-file">{file.name}</div>}
            <div className="dropzone-title">
              {busy ? "Analyzing evidence…" : "Drop file here or click to browse"}
            </div>
            <div className="dropzone-hint">TXT · LOG · CSV · JSON — max {maxMb} MB</div>
          </div>

          {error && (
            <div className="alert alert-error mt-3">
              <AlertTriangle size={13} className="alert-icon" />
              <span className="alert-text">{error}</span>
            </div>
          )}
        </Card>

        {/* Live generator */}
        <Card
          title={<><Radio size={14} /> Live SOC Feed</>}
          actions={
            <Badge tone={status?.running ? "ok" : "default"}>
              {status?.running ? "streaming" : "idle"}
            </Badge>
          }
        >
          <div className="flex-col gap-4">
            <p style={{ fontSize: "var(--text-sm)" }}>
              Stream synthetic traffic through the same detection pipeline to exercise anomaly scoring and live incident correlation in real time.
            </p>

            <div className="mode-grid">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  className={`mode-btn${mode === m.id ? " selected" : ""}`}
                  onClick={() => setMode(m.id)}
                  disabled={status?.running}
                >
                  <span className="mode-btn-name">{m.name}</span>
                  <span className="mode-btn-desc">{m.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3 items-center">
              {status?.running ? (
                <Button variant="danger" icon={<Square size={13} />} onClick={() => stopFeed(setStatus, toast)}>
                  Stop feed
                </Button>
              ) : (
                <Button icon={<Play size={13} />} onClick={() => startFeed(mode, setStatus, toast)}>
                  Start streaming
                </Button>
              )}
              {status?.last_error && (
                <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--critical)" }}>
                  {status.last_error}
                </span>
              )}
            </div>

            {status && (
              <div className="kv-list" style={{ paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <div className="kv-item">
                  <span className="kv-key">Mode</span>
                  <span className="kv-value">{status.mode || "—"}</span>
                </div>
                <div className="kv-item">
                  <span className="kv-key">Activity</span>
                  <span className="kv-value">{status.activity}</span>
                </div>
                <div className="kv-item">
                  <span className="kv-key">Source</span>
                  <span className="kv-value">{status.source.name}</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent uploads */}
      <Card
        title="Recent Evidence"
        actions={<Link className="btn btn-ghost btn-sm" to="/upload/history">Archive <ArrowRight size={12} /></Link>}
      >
        <RecentUploads onPick={(id) => navigate(`/logs/${id}`)} />
      </Card>
    </div>
  );
}

function RecentUploads({ onPick }: { onPick: (id: number) => void }) {
  const uploads = useApi(() => api.uploads(5));
  if (uploads.loading) return <div className="skeleton skeleton-block" style={{ height: 100 }} />;
  if (!uploads.data || uploads.data.length === 0)
    return <EmptyState title="No evidence yet" hint="Upload a log file to begin analysis." />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>File</th><th>Uploaded</th><th>Records</th><th>Status</th></tr>
        </thead>
        <tbody>
          {uploads.data.map((row) => (
            <tr key={row.id} className="table-row-link" onClick={() => onPick(row.id)}>
              <td className="mono">{row.file_name}</td>
              <td className="mono dim">{formatTime(row.upload_time)}</td>
              <td className="mono">{row.total_records.toLocaleString()}</td>
              <td>{statusBadge(row.processing_status)}</td>
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
      try { const d = await api.generatorStatus(); if (active) setStatus(d); } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { active = false; clearInterval(t); };
  }, []);
  return [status, setStatus] as const;
}

async function startFeed(mode: string, set: React.Dispatch<React.SetStateAction<GeneratorStatus | null>>, toast: ReturnType<typeof useToast>) {
  try {
    const r = await api.generatorStart(mode);
    set((p) => p ? { ...p, running: true, mode: r.mode, last_error: null } : p);
    toast(`Streaming · ${r.mode} mode`, "success");
  } catch (err) { toast(err instanceof Error ? err.message : "Failed to start feed", "error"); }
}

async function stopFeed(set: React.Dispatch<React.SetStateAction<GeneratorStatus | null>>, toast: ReturnType<typeof useToast>) {
  try {
    const r = await api.generatorStop();
    set((p) => p ? { ...p, running: false, last_error: r.error } : p);
    toast("Feed stopped", "info");
  } catch (err) { toast(err instanceof Error ? err.message : "Failed to stop feed", "error"); }
}
