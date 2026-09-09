import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowLeft, FileText, Hash,
  Search, ShieldAlert, Target, ThumbsDown, ThumbsUp
} from "lucide-react";
import { api, formatTime, formatTimeShort, shortHash } from "../api/client";
import type { IncidentDetail, RiskEvent } from "../api/types";
import { useApi } from "../hooks/useApi";
import { useInView } from "../hooks/useInView";
import { Badge, severityBadge, statusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { GaugeRing } from "../components/ui/GaugeRing";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

type Tab = "logs" | "risks" | "incidents" | "report";

export function EvidenceExplorer() {
  const { fileId } = useParams();
  const id = Number(fileId);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("logs");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const metricsRef = useInView();

  const detail = useApi(() => api.uploadDetail(id), [id]);
  const logs   = useApi(() => api.logs(id, { q: debouncedQ, source, status }), [id, debouncedQ, source, status]);

  const upload  = detail.data;
  const risks   = useMemo(() => upload?.risks ?? [], [upload]);
  const sources = useMemo(() => Object.keys(logs.data?.source_counts ?? {}), [logs.data]);
  const sourceCounts = logs.data?.source_counts ?? {};
  const visibleLogs  = logs.data?.logs ?? [];

  function handleSearch(val: string) {
    setQ(val);
    setTimeout(() => setDebouncedQ(val), 300);
  }

  if (detail.loading) return <div className="page"><Card><Skeleton /></Card></div>;

  if (detail.error || !upload) return (
    <div className="page">
      <Card>
        <EmptyState
          title="Evidence not found"
          hint={detail.error ?? "This evidence file may have expired or is outside your current scope."}
          icon={<AlertTriangle size={36} strokeWidth={1.4} />}
          action={<Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => navigate("/upload/history")}>Return to Evidence Archive</Button>}
        />
      </Card>
    </div>
  );

  return (
    <div className="page">
      {/* Header Banner */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2 anim-fade-right">
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate("/upload/history")}>
              Evidence Archive
            </Button>
            <span className="text-muted">·</span>
            <span className="mono dim text-xs">EVIDENCE #{upload.id}</span>
          </div>

          <h1 className="mono text-2xl font-bold text-primary anim-fade-right stagger-1">{upload.file_name}</h1>

          <div className="flex gap-2 flex-wrap items-center mt-2.5 anim-fade-right stagger-2">
            {statusBadge(upload.processing_status)}
            <Badge tone="info" dot={false}>{upload.total_records.toLocaleString()} Records</Badge>
            {(upload.risk_count ?? 0) > 0 && <Badge tone="medium" dot={false}>{upload.risk_count} Risk Signals</Badge>}
            {(upload.incident_count ?? 0) > 0 && <Badge tone="critical" dot={false}>{upload.incident_count} Incidents</Badge>}
          </div>

          <div className="flex gap-4 flex-wrap mt-2 anim-fade-right stagger-3">
            <span className="mono dim text-xs flex items-center gap-1 bg-raised px-2.5 py-1 rounded border border-subtle">
              <Hash size={11} className="text-accent" /> SHA-256: {shortHash(upload.content_hash)}
            </span>
            <span className="mono dim text-xs flex items-center gap-1 bg-raised px-2.5 py-1 rounded border border-subtle">
              {upload.file_type.toUpperCase()} · Ingested {formatTime(upload.upload_time)}
            </span>
          </div>
        </div>

        <Link className="btn btn-primary hover-glow anim-fade-left" to={`/reports/${upload.id}`}>
          <FileText size={14} /> Open Forensic Report
        </Link>
      </div>

      {/* Forensic Trust & Quality Strip */}
      <Card title={<><Activity size={15} /> Forensic Trust &amp; Data Quality Integrity</>} animate>
        <div ref={metricsRef.ref} className="flex gap-8 flex-wrap items-center justify-around py-2">
          <GaugeRing value={upload.quality?.quality_score ?? 0} caption="Data Quality" accent="#16a34a" />
          <GaugeRing value={upload.quality?.health_score ?? 0} caption="Health Index" accent="#388bfd" />
          <GaugeRing value={upload.forensic_trust?.score ?? 0} caption="Forensic Trust" accent="#e3b341" />

          <div className={`kv-list flex-1 min-w-[220px] max-w-[280px] ${metricsRef.visible ? "anim-fade-left stagger-3" : ""}`}>
            <div className="kv-item"><span className="kv-key">Rule/ML Agreement</span><span className="kv-value font-mono font-bold text-accent">{upload.forensic_trust?.agreement_rate?.toFixed(0) ?? "—"}%</span></div>
            <div className="kv-item"><span className="kv-key">Avg Risk Score</span><span className="kv-value font-mono font-bold text-medium">{upload.forensic_trust?.average_risk_score?.toFixed(1) ?? "—"}</span></div>
            <div className="kv-item"><span className="kv-key">Risk Coverage</span><span className="kv-value font-mono font-bold text-primary">{upload.forensic_trust?.coverage_rate?.toFixed(0) ?? "—"}%</span></div>
            <div className="kv-item"><span className="kv-key">MITRE Mapping</span><span className="kv-value font-mono font-bold text-mitre">{upload.forensic_trust?.mitre_coverage_rate?.toFixed(0) ?? "—"}%</span></div>
          </div>
        </div>
      </Card>

      {/* Investigation Tabs Card */}
      <Card pad="none" flush animate delay={80}>
        <div className="tab-list">
          {(["logs", "risks", "incidents", "report"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`tab-trigger${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "logs" && "Log Stream"}
              {t === "risks" && `Flagged Risks (${risks.length})`}
              {t === "incidents" && `Attack Chains (${upload.incident_count ?? 0})`}
              {t === "report" && "Forensic Report"}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === "logs" && (
            <LogsTab
              q={q} source={source} status={status}
              onSearch={handleSearch} onSource={setSource} onStatus={setStatus}
              logs={visibleLogs} loading={logs.loading}
              sources={sources} sourceCounts={sourceCounts}
              total={upload.total_records} onLabel={detail.refetch}
            />
          )}
          {tab === "risks" && <RisksTab risks={risks} onLabel={detail.refetch} />}
          {tab === "incidents" && <IncidentsTab fileId={id} />}
          {tab === "report" && (
            <div className="flex-col gap-4 py-2 anim-fade-up">
              <p className="text-sm text-secondary leading-relaxed">
                Generate an official, court-verifiable forensic PDF report with cryptographic SHA-256 chain-of-custody,
                data quality indices, trust score formulation, attack timelines, and MITRE ATT&amp;CK technique matrices.
              </p>
              <Link className="btn btn-primary hover-glow self-start" to={`/reports/${upload.id}`}>
                <FileText size={14} /> Open Report Preview &amp; Download PDF
              </Link>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function LogsTab({ q, source, status, onSearch, onSource, onStatus, logs, loading, sources, sourceCounts, total, onLabel }: {
  q: string; source: string; status: string;
  onSearch: (v: string) => void; onSource: (v: string) => void; onStatus: (v: string) => void;
  logs: any[]; loading: boolean; sources: string[];
  sourceCounts: Record<string, number>; total: number; onLabel: () => void;
}) {
  return (
    <div>
      <div className="filter-bar -m-5 mb-4 p-4">
        <div className="field wide">
          <label className="field-label">Search Telemetry</label>
          <div className="input-group">
            <Search size={14} className="input-group-icon" />
            <input className="input" placeholder="Search IP, endpoint, status, message…" value={q} onChange={(e) => onSearch(e.target.value)} />
          </div>
        </div>
        <div className="field narrow">
          <label className="field-label">Log Source</label>
          <select className="select-input" value={source} onChange={(e) => onSource(e.target.value)}>
            <option value="">All log sources</option>
            {sources.map((s) => <option key={s} value={s}>{s} ({sourceCounts[s] ?? 0})</option>)}
          </select>
        </div>
        <div className="field narrow">
          <label className="field-label">Risk Filter</label>
          <select className="select-input" value={status} onChange={(e) => onStatus(e.target.value)}>
            <option value="">All records</option>
            <option value="1">Flagged only</option>
            <option value="0">Clean only</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-muted font-mono mb-3">
        {loading ? "Querying records…" : `Showing ${logs.length} of ${total.toLocaleString()} normalized records`}
      </div>

      {loading ? (
        <Skeleton />
      ) : logs.length === 0 ? (
        <EmptyState title="No log records match query" hint="Try broadening your search or clearing active filters." icon={<Search size={32} strokeWidth={1.4} />} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Source IP</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Source Type</th>
                <th>Threat Status</th>
                <th>Analyst Feedback</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any, i: number) => (
                <tr key={log.id} className={`anim-fade-up stagger-${Math.min((i % 8) + 1, 8)}`}>
                  <td className="mono dim text-xs">{formatTimeShort(log.timestamp)}</td>
                  <td className="mono font-semibold text-accent">{log.source_ip ?? "—"}</td>
                  <td className="mono text-xs font-bold">{log.method ?? "—"}</td>
                  <td className="mono text-xs max-w-[200px] truncate">{log.endpoint ?? "—"}</td>
                  <td className="mono text-xs">{log.status_code ?? "—"}</td>
                  <td className="dim text-xs">{log.log_source_type ?? "—"}</td>
                  <td>{log.risk ? severityBadge(log.risk.severity) : <span className="dim text-xs">Clean</span>}</td>
                  <td>{log.risk ? <RiskLabel riskId={log.risk.id} label={log.risk.analyst_label} onLabel={onLabel} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RisksTab({ risks, onLabel }: { risks: RiskEvent[]; onLabel: () => void }) {
  if (risks.length === 0) return (
    <EmptyState title="No threat signals flagged" hint="This evidence produced no anomalous detections." icon={<AlertTriangle size={32} strokeWidth={1.4} />} />
  );
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Category</th>
            <th>Severity</th>
            <th>Risk Score</th>
            <th>MITRE Technique</th>
            <th>Detection Rationale</th>
            <th>Analyst Verdict</th>
          </tr>
        </thead>
        <tbody>
          {risks.map((risk, i) => (
            <tr key={risk.id} className={`anim-fade-up stagger-${Math.min((i % 8) + 1, 8)}`}>
              <td className="mono dim text-xs">#{risk.id}</td>
              <td className="font-semibold text-primary">{risk.risk_category}</td>
              <td>{severityBadge(risk.severity)}</td>
              <td>
                <div className="flex items-center gap-2">
                  <div className="progress-track w-14">
                    <div
                      className={`progress-fill ${risk.risk_score >= 80 ? "danger" : risk.risk_score >= 60 ? "warning" : ""}`}
                      style={{ width: `${risk.risk_score}%` }}
                    />
                  </div>
                  <span className="mono text-xs font-bold text-medium">{risk.risk_score.toFixed(0)}</span>
                </div>
              </td>
              <td>
                {risk.mitre_mapping ? (
                  <div className="flex flex-col gap-0.5">
                    <Badge tone="mitre" dot={false}>{risk.mitre_mapping.technique_id}</Badge>
                    <span className="dim text-[10px] truncate max-w-[120px]">{risk.mitre_mapping.tactic}</span>
                  </div>
                ) : <span className="dim text-xs">—</span>}
              </td>
              <td className="max-w-[260px] whitespace-normal text-xs text-secondary leading-relaxed">{risk.reason}</td>
              <td><RiskLabel riskId={risk.id} label={risk.analyst_label ?? null} onLabel={onLabel} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IncidentsTab({ fileId }: { fileId: number }) {
  const incidents = useApi(() => api.incidents(fileId), [fileId]);
  if (incidents.loading) return <Skeleton />;
  if (!incidents.data || incidents.data.incidents.length === 0)
    return <EmptyState title="No attack chains detected" hint="No correlated multi-stage incidents for this log set." icon={<ShieldAlert size={32} strokeWidth={1.4} />} />;
  return (
    <div className="grid-2">
      {incidents.data.incidents.map((inc: IncidentDetail, i: number) => (
        <div key={inc.id ?? i} className={`card hover-lift anim-fade-up stagger-${Math.min(i + 1, 8)} p-5`}>
          <div className="flex justify-between items-center mb-3">
            {severityBadge(inc.severity)}
            <span className="mono text-sm font-bold text-medium">Risk: {inc.score.toFixed(1)}/100</span>
          </div>
          <h4 className="font-bold text-base text-primary mb-1.5">{inc.title}</h4>
          <p className="text-xs text-secondary mb-4 leading-relaxed">{inc.summary}</p>
          <div className="incident-timeline">
            {inc.events.slice(0, 4).map((ev, j) => (
              <div key={j} className="timeline-event">
                <div className={`timeline-event-dot ${(inc.severity ?? "").toLowerCase()}`} />
                <div className="timeline-event-content">
                  <div className="timeline-event-desc">{ev.description}</div>
                  <div className="timeline-event-time">{formatTimeShort(ev.event_time)}</div>
                  {ev.mitre_tactic && <Badge tone="mitre" dot={false} className="mt-1"><Target size={9} /> {ev.mitre_tactic}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskLabel({ riskId, label, onLabel }: { riskId: number; label: string | null; onLabel: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function apply(l: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.labelRisk(riskId, l);
      toast(l === "confirmed" ? "Threat confirmed" : "Marked as false positive", "success");
      onLabel();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Label update failed", "error");
    } finally { setBusy(false); }
  }
  if (label) return <Badge tone={label === "confirmed" ? "ok" : "info"} dot={false}>{label}</Badge>;
  return (
    <div className="flex gap-1">
      <button className="btn btn-ghost btn-icon hover:text-ok" title="Confirm threat" onClick={() => apply("confirmed")} disabled={busy}>
        <ThumbsUp size={13} />
      </button>
      <button className="btn btn-ghost btn-icon hover:text-critical" title="False positive" onClick={() => apply("false_positive")} disabled={busy}>
        <ThumbsDown size={13} />
      </button>
    </div>
  );
}
