import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, FileText, Search, ShieldAlert, Target,
  ThumbsDown, ThumbsUp, Activity, Hash,
} from "lucide-react";
import { api, formatTime, formatTimeShort, shortHash } from "../api/client";
import type { IncidentDetail, RiskEvent } from "../api/types";
import { useApi } from "../hooks/useApi";
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

  const detail = useApi(() => api.uploadDetail(id), [id]);
  const logs = useApi(() => api.logs(id, { q: debouncedQ, source, status }), [id, debouncedQ, source, status]);

  const handleSearch = (val: string) => {
    setQ(val);
    setTimeout(() => setDebouncedQ(val), 350);
  };

  const upload = detail.data;
  const risks = useMemo(() => upload?.risks ?? [], [upload]);
  const sources = useMemo(() => Object.keys(logs.data?.source_counts ?? {}), [logs.data]);
  const sourceCounts = logs.data?.source_counts ?? {};
  const visibleLogs = logs.data?.logs ?? [];

  if (detail.loading) return (
    <div className="page"><Card><Skeleton /></Card></div>
  );

  if (detail.error || !upload) return (
    <div className="page">
      <Card>
        <EmptyState
          title="Evidence not found"
          hint={detail.error ?? "This file may have been removed or is outside your scope."}
          icon={<AlertTriangle size={36} strokeWidth={1.4} />}
          action={<Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => navigate("/upload/history")}>Back to archive</Button>}
        />
      </Card>
    </div>
  );

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate("/upload/history")}>
              Archive
            </Button>
            <span style={{ color: "var(--text-muted)", fontSize: "var(--text-xs)" }}>·</span>
            <span className="mono dim" style={{ fontSize: "var(--text-xs)" }}>#{upload.id}</span>
          </div>
          <h1 className="mono" style={{ fontSize: "var(--text-xl)" }}>{upload.file_name}</h1>
          <div className="flex gap-2 flex-wrap" style={{ marginTop: 8 }}>
            {statusBadge(upload.processing_status)}
            <Badge tone="info" dot={false}>{upload.total_records.toLocaleString()} records</Badge>
            {(upload.risk_count ?? 0) > 0 && <Badge tone="medium" dot={false}>{upload.risk_count} risks</Badge>}
            {(upload.incident_count ?? 0) > 0 && <Badge tone="critical" dot={false}>{upload.incident_count} incidents</Badge>}
          </div>
          <div className="flex gap-3 flex-wrap" style={{ marginTop: 6 }}>
            <span className="mono dim" style={{ fontSize: "var(--text-xs)" }}>
              <Hash size={10} style={{ display: "inline", verticalAlign: -1 }} /> {shortHash(upload.content_hash)}
            </span>
            <span className="mono dim" style={{ fontSize: "var(--text-xs)" }}>
              {upload.file_type.toUpperCase()} · {formatTime(upload.upload_time)}
            </span>
          </div>
        </div>
        <Link className="btn btn-primary btn-sm" to={`/reports/${upload.id}`}>
          <FileText size={13} /> Open report
        </Link>
      </div>

      {/* Trust metrics strip */}
      <Card title={<><Activity size={14} /> Evidence Quality &amp; Trust</>}>
        <div className="flex gap-6 flex-wrap items-center" style={{ justifyContent: "space-around" }}>
          <GaugeRing value={upload.quality?.quality_score ?? 0} caption="Data Quality" accent="#3fb950" />
          <GaugeRing value={upload.quality?.health_score ?? 0} caption="Health Index" accent="#388bfd" />
          <GaugeRing value={upload.forensic_trust?.score ?? 0} caption="Forensic Trust" accent="#e3b341" />

          <div className="kv-list" style={{ minWidth: 200 }}>
            <div className="kv-item">
              <span className="kv-key">Rule/ML agreement</span>
              <span className="kv-value">{upload.forensic_trust?.agreement_rate?.toFixed(0) ?? "—"}%</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Avg risk score</span>
              <span className="kv-value" style={{ color: "var(--medium)" }}>
                {upload.forensic_trust?.average_risk_score?.toFixed(1) ?? "—"}
              </span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Coverage</span>
              <span className="kv-value">{upload.forensic_trust?.coverage_rate?.toFixed(0) ?? "—"}%</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">MITRE mapping</span>
              <span className="kv-value">{upload.forensic_trust?.mitre_coverage_rate?.toFixed(0) ?? "—"}%</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Duplicates</span>
              <span className="kv-value">{upload.quality?.duplicate_logs ?? 0}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card pad="none" flush>
        <div className="tab-list">
          {(["logs", "risks", "incidents", "report"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`tab-trigger${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "logs" && "Log stream"}
              {t === "risks" && `Risks (${risks.length})`}
              {t === "incidents" && `Incidents (${upload.incident_count ?? 0})`}
              {t === "report" && "Report"}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === "logs" && (
            <LogsTab
              q={q} source={source} status={status}
              onSearch={handleSearch}
              onSource={setSource}
              onStatus={setStatus}
              logs={visibleLogs}
              loading={logs.loading}
              sources={sources}
              sourceCounts={sourceCounts}
              total={upload.total_records}
              onLabel={detail.refetch}
            />
          )}
          {tab === "risks" && <RisksTab risks={risks} onLabel={detail.refetch} />}
          {tab === "incidents" && <IncidentsTab fileId={id} />}
          {tab === "report" && (
            <div className="flex-col gap-4">
              <p style={{ fontSize: "var(--text-sm)" }}>
                Generate a forensic PDF report for this evidence — quality metrics, trust formula, top findings, incident timelines, and MITRE mappings.
              </p>
              <div>
                <Link className="btn btn-primary" to={`/reports/${upload.id}`}>
                  <FileText size={14} /> Open report preview
                </Link>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function LogsTab({
  q, source, status, onSearch, onSource, onStatus,
  logs, loading, sources, sourceCounts, total, onLabel,
}: {
  q: string; source: string; status: string;
  onSearch: (v: string) => void; onSource: (v: string) => void; onStatus: (v: string) => void;
  logs: any[]; loading: boolean; sources: string[];
  sourceCounts: Record<string, number>; total: number; onLabel: () => void;
}) {
  return (
    <div>
      <div className="filter-bar" style={{ margin: "-20px -20px 16px" }}>
        <div className="field wide">
          <label className="field-label">Search</label>
          <div className="input-group">
            <Search size={13} className="input-group-icon" />
            <input className="input" placeholder="endpoint, IP, message…" value={q} onChange={(e) => onSearch(e.target.value)} />
          </div>
        </div>
        <div className="field narrow">
          <label className="field-label">Source type</label>
          <select className="select-input" value={source} onChange={(e) => onSource(e.target.value)}>
            <option value="">All sources</option>
            {sources.map((s) => <option key={s} value={s}>{s} ({sourceCounts[s] ?? 0})</option>)}
          </select>
        </div>
        <div className="field narrow">
          <label className="field-label">Risk filter</label>
          <select className="select-input" value={status} onChange={(e) => onStatus(e.target.value)}>
            <option value="">All logs</option>
            <option value="1">Flagged only</option>
            <option value="0">Clean only</option>
          </select>
        </div>
      </div>

      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
        {loading ? "Loading…" : `${logs.length} of ${total.toLocaleString()} records`}
      </div>

      {loading ? <Skeleton /> : logs.length === 0 ? (
        <EmptyState title="No logs match" hint="Adjust your filters." icon={<Search size={32} strokeWidth={1.4} />} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th><th>Source IP</th><th>Method</th><th>Endpoint</th>
                <th>Status</th><th>Source</th><th>Risk</th><th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td className="mono dim">{formatTimeShort(log.timestamp)}</td>
                  <td className="mono" style={{ color: "var(--accent)" }}>{log.source_ip ?? "—"}</td>
                  <td className="mono">{log.method ?? "—"}</td>
                  <td className="mono" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.endpoint ?? "—"}
                  </td>
                  <td className="mono">{log.status_code ?? "—"}</td>
                  <td className="dim">{log.log_source_type ?? "—"}</td>
                  <td>
                    {log.risk ? severityBadge(log.risk.severity) : (
                      <span className="dim" style={{ fontSize: "var(--text-xs)" }}>clean</span>
                    )}
                  </td>
                  <td>
                    {log.risk ? (
                      <RiskLabel riskId={log.risk.id} label={log.risk.analyst_label} onLabel={onLabel} />
                    ) : null}
                  </td>
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
    <EmptyState title="No risk events" hint="This evidence set produced no flagged anomalies." icon={<AlertTriangle size={32} strokeWidth={1.4} />} />
  );
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>ID</th><th>Category</th><th>Severity</th><th>Score</th>
            <th>MITRE</th><th>Reason</th><th>Decision</th>
          </tr>
        </thead>
        <tbody>
          {risks.map((risk) => (
            <tr key={risk.id}>
              <td className="mono dim">#{risk.id}</td>
              <td>{risk.risk_category}</td>
              <td>{severityBadge(risk.severity)}</td>
              <td className="mono" style={{ color: "var(--medium)" }}>{risk.risk_score.toFixed(1)}</td>
              <td>
                {risk.mitre_mapping ? (
                  <div className="flex-col gap-1">
                    <Badge tone="mitre" dot={false}>{risk.mitre_mapping.technique_id}</Badge>
                    <span className="dim" style={{ fontSize: "var(--text-xs)" }}>{risk.mitre_mapping.tactic}</span>
                  </div>
                ) : <span className="dim" style={{ fontSize: "var(--text-xs)" }}>—</span>}
              </td>
              <td style={{ maxWidth: 280, whiteSpace: "normal", fontSize: "var(--text-xs)", lineHeight: 1.4 }}>{risk.reason}</td>
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
    return <EmptyState title="No incidents" hint="No correlated attack chains for this evidence set." icon={<ShieldAlert size={32} strokeWidth={1.4} />} />;

  return (
    <div className="grid-2">
      {incidents.data.incidents.map((inc: IncidentDetail) => (
        <div key={inc.id ?? inc.title} className="card" style={{ padding: "var(--sp-4)" }}>
          <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
            {severityBadge(inc.severity)}
            <span className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--medium)" }}>{inc.score.toFixed(1)}</span>
          </div>
          <h4 style={{ marginBottom: 6 }}>{inc.title}</h4>
          <p style={{ fontSize: "var(--text-xs)", marginBottom: 12 }}>{inc.summary}</p>

          <div className="incident-timeline">
            {inc.events.map((ev, i) => (
              <div key={i} className="timeline-event">
                <div className={`timeline-event-dot ${(inc.severity ?? "").toLowerCase()}`} />
                <div className="timeline-event-content">
                  <div className="timeline-event-type">{ev.event_type ?? "Event"}</div>
                  <div className="timeline-event-desc">{ev.description}</div>
                  <div className="timeline-event-time">{formatTimeShort(ev.event_time)}</div>
                  {ev.mitre_tactic && (
                    <div style={{ marginTop: 4 }}>
                      <Badge tone="mitre" dot={false}><Target size={9} /> {ev.mitre_tactic}</Badge>
                    </div>
                  )}
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
      toast(l === "confirmed" ? "Risk confirmed" : "Marked as false positive", "success");
      onLabel();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Label failed", "error");
    } finally { setBusy(false); }
  }

  if (label) return <Badge tone={label === "confirmed" ? "ok" : "info"} dot={false}>{label}</Badge>;

  return (
    <div className="flex gap-1">
      <button className="btn btn-ghost btn-icon" title="Confirm threat" onClick={() => apply("confirmed")} disabled={busy}>
        <ThumbsUp size={12} />
      </button>
      <button className="btn btn-ghost btn-icon" title="False positive" onClick={() => apply("false_positive")} disabled={busy}>
        <ThumbsDown size={12} />
      </button>
    </div>
  );
}
