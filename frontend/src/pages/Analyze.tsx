import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Cpu,
  FileUp, Loader2, Play, Radio, Square, UploadCloud,
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
  { id: "normal", name: "Normal traffic",  desc: "Background web activity" },
  { id: "scan",   name: "Reconnaissance",  desc: "Route probing & discovery" },
  { id: "brute",  name: "Brute force",     desc: "Credential stuffing bursts" },
  { id: "breach", name: "Breach scenario", desc: "Full attack simulation" },
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
    if (f && !busy) { setFile(f); upload(f); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const maxMb = config.data?.max_upload_mb ?? 100;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Upload Logs</h1>
          <p>Upload and manage your log files for analysis</p>
        </div>
        <Badge tone="info" dot={false}>Max {maxMb} MB per file</Badge>
      </div>

      {/* Pipeline progress */}
      <div className="pipeline-steps">
        {PIPELINE.map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <span className={`pipeline-step ${phase === i ? "active" : phase > i ? "done" : ""}`}>
              {phase > i
                ? <CheckCircle2 size={12} />
                : phase === i
                ? <Loader2 size={12} className="animate-spin" />
                : <Cpu size={12} />}
              {step}
            </span>
            {i < PIPELINE.length - 1 && <span className="pipeline-arrow">›</span>}
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Upload */}
        <Card title={<><FileUp size={14} /> Upload Evidence File</>}>
          <input
            ref={inputRef} type="file"
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
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            aria-label="Upload log file"
          >
            <UploadCloud size={32} className="dropzone-icon" />
            {file ? (
              <div className="dropzone-file">{file.name}</div>
            ) : null}
            <div className="dropzone-title">
              {busy ? "Analyzing evidence…" : "Drag and drop your log files here"}
            </div>
            <p className="dropzone-hint">or</p>
            {!busy && (
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              >
                Browse Files
              </button>
            )}
            <div className="dropzone-hint">
              Supports: .log, .txt, .json, .csv, .evtx | Max size: {maxMb}MB
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
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
              Stream synthetic traffic through the detection pipeline in real time.
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

            <div className="flex gap-3 items-center">
              {status?.running ? (
                <Button variant="danger" icon={<Square size={13} />}
                  onClick={() => stopFeed(setStatus, toast)}>
                  Stop feed
                </Button>
              ) : (
                <Button icon={<Play size={13} />}
                  onClick={() => startFeed(mode, setStatus, toast)}>
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
                <div className="kv-item"><span className="kv-key">Mode</span><span className="kv-value">{status.mode || "—"}</span></div>
                <div className="kv-item"><span className="kv-key">Activity</span><span className="kv-value">{status.activity}</span></div>
                <div className="kv-item"><span className="kv-key">Source</span><span className="kv-value">{status.source?.name ?? "—"}</span></div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Uploaded files table */}
      <Card
        title={<>Uploaded Files</>}
        actions={<Link className="btn btn-ghost btn-sm" to="/upload/history">View all <ArrowRight size={12} /></Link>}
      >
        <UploadSummaryPanel />
      </Card>
    </div>
  );
}

function UploadSummaryPanel() {
  const navigate = useNavigate();
  const uploads = useApi(() => api.uploads(10));

  if (uploads.loading) return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ marginBottom: 8 }} />
      ))}
    </div>
  );

  if (!uploads.data || uploads.data.length === 0) {
    return (
      <EmptyState
        title="No files uploaded yet"
        hint="Upload a log file to begin analysis."
        icon={<FileUp size={32} strokeWidth={1.4} />}
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Size</th>
            <th>Format</th>
            <th>Uploaded By</th>
            <th>Upload Time</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {uploads.data.map((row) => (
            <tr key={row.id}>
              <td className="mono" style={{ fontWeight: 500 }}>{row.file_name}</td>
              <td className="dim mono" style={{ fontSize: "var(--text-xs)" }}>{formatSize(row.file_size)}</td>
              <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{row.file_type}</span></td>
              <td style={{ fontSize: "var(--text-sm)" }}>Analyst</td>
              <td className="dim mono" style={{ fontSize: "var(--text-xs)" }}>{formatTime(row.upload_time)}</td>
              <td>{statusBadge(row.processing_status)}</td>
              <td>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => navigate(`/logs/${row.id}`)}
                  title="View analysis"
                >
                  <ArrowRight size={13} />
                </button>
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
    toast(`Streaming · ${r.mode} mode`, "success");
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
    toast("Feed stopped", "info");
  } catch (err) {
    toast(err instanceof Error ? err.message : "Failed to stop feed", "error");
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}
