import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, FileText, ShieldAlert, Target, Zap } from "lucide-react";
import { api, formatTime, formatTimeShort } from "../api/client";
import type { IncidentDetail } from "../api/types";
import { useApi } from "../hooks/useApi";
import { Badge, severityBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

export function Incidents() {
  const { fileId } = useParams();
  if (fileId) return <FileIncidents fileId={Number(fileId)} />;
  return <AllIncidents />;
}

function AllIncidents() {
  const navigate = useNavigate();
  const uploads = useApi(() => api.uploads(200));
  const withIncidents = (uploads.data ?? []).filter((u) => (u.incident_count ?? 0) > 0);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right flex items-center gap-2">
            <ShieldAlert size={22} className="text-critical" />
            <span>Correlated Attack Incidents</span>
          </h1>
          <p className="anim-fade-right stagger-1">
            Multi-stage attack chains correlated across ingested log telemetry.
          </p>
        </div>
        {withIncidents.length > 0 && (
          <Badge tone="critical" dot={false} className="anim-fade-left">
            {withIncidents.length} Evidence Files with Threats
          </Badge>
        )}
      </div>

      {uploads.loading ? (
        <Card><Skeleton /></Card>
      ) : withIncidents.length === 0 ? (
        <Card>
          <EmptyState
            title="No Correlated Incidents Detected"
            hint="Upload security log evidence to correlate threat events into incident attack chains."
            icon={<ShieldAlert size={36} strokeWidth={1.4} />}
            action={<Link className="btn btn-primary" to="/upload"><Zap size={14} /> Ingest Log File</Link>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {withIncidents.map((upload) => (
            <div
              key={upload.id}
              className="card hover-lift p-5 cursor-pointer flex justify-between items-center"
              onClick={() => navigate(`/incidents/${upload.id}`)}
            >
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  <ShieldAlert size={16} className="text-critical" />
                  <span className="font-bold text-base text-primary">{upload.file_name}</span>
                  <Badge tone="critical" dot={false}>
                    {upload.incident_count} Incident{(upload.incident_count ?? 0) > 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="text-xs text-muted font-mono">
                  {upload.total_records.toLocaleString()} Records · Ingested {formatTime(upload.upload_time)}
                </div>
              </div>
              <div className="flex items-center gap-2 text-accent font-semibold text-xs">
                <span>Inspect Attack Chains</span>
                <ArrowRight size={15} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ITab = "overview" | "timeline" | "events" | "mitre" | "evidence";

function FileIncidents({ fileId }: { fileId: number }) {
  const navigate = useNavigate();
  const incidents = useApi(() => api.incidents(fileId), [fileId]);
  const [selected, setSelected] = useState<IncidentDetail | null>(null);
  const [tab, setTab] = useState<ITab>("overview");

  const data = incidents.data;
  const inc = selected ?? data?.incidents?.[0] ?? null;

  if (incidents.loading) return <div className="page"><Card><Skeleton /></Card></div>;

  if (!data || data.incidents.length === 0) return (
    <div className="page">
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate("/incidents")} style={{ marginBottom: 8 }}>
        All Incidents
      </Button>
      <Card><EmptyState title="No attack chains detected for this file" icon={<ShieldAlert size={36} strokeWidth={1.4} />} /></Card>
    </div>
  );

  const TABS: { id: ITab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview & Score" },
    { id: "timeline", label: "Attack Timeline" },
    { id: "events", label: "Correlated Events", count: inc?.events?.length },
    { id: "mitre", label: "MITRE ATT&CK Mapping", count: inc?.events?.filter((e) => e.mitre_tactic).length },
    { id: "evidence", label: "Evidence Metadata" },
  ];

  return (
    <div className="page">
      <div className="page-breadcrumb anim-fade-down">
        <Link to="/incidents">Incidents</Link>
        <span>›</span>
        <span className="page-breadcrumb-current">{inc?.title ?? `Evidence #${fileId}`}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="anim-fade-right text-2xl font-bold text-primary">Incident Investigation Workspace</h1>
          <p className="text-xs text-secondary mt-1">Multi-stage attack chain correlation and timeline reconstruction.</p>
        </div>
        {inc && (
          <Link className="btn btn-primary btn-sm hover-glow anim-fade-left" to={`/reports/${fileId}`}>
            <FileText size={14} /> Export Forensic Report
          </Link>
        )}
      </div>

      {data.incidents.length > 1 && (
        <Card animate>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs font-mono text-muted uppercase tracking-wider mr-2">Attack Chains:</span>
            {data.incidents.map((i, idx) => (
              <button
                key={idx}
                onClick={() => { setSelected(i); setTab("overview"); }}
                className={`btn btn-sm ${selected === i || (selected === null && idx === 0) ? "btn-primary" : "btn-secondary"}`}
              >
                {i.title}
              </button>
            ))}
          </div>
        </Card>
      )}

      {inc && (
        <Card pad="none" flush animate delay={60}>
          {/* Metadata Row */}
          <div className="p-5 border-b border-subtle bg-surface/50">
            <div className="grid-3">
              {[
                { label: "Threat Severity", value: severityBadge(inc.severity) },
                { label: "Risk Index", value: <span className="font-mono text-sm font-bold text-accent">{inc.score.toFixed(1)} / 100</span> },
                { label: "Initial Detection", value: <span className="mono text-xs text-secondary">{formatTime(inc.events?.[0]?.event_time)}</span> },
              ].map((f) => (
                <div key={f.label}>
                  <div className="text-[11px] font-mono font-bold text-muted uppercase tracking-wider mb-1">{f.label}</div>
                  <div>{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="tab-list">
            {TABS.map((t) => (
              <button key={t.id} className={`tab-trigger${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === t.id ? "bg-accent text-white" : "bg-raised text-muted"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <IncidentTabContent inc={inc} tab={tab} fileId={fileId} />
            <IncidentSidePanel inc={inc} tab={tab} />
          </div>
        </Card>
      )}
    </div>
  );
}

function IncidentTabContent({ inc, tab, fileId }: { inc: IncidentDetail; tab: ITab; fileId: number }) {
  const sectionLabel = (t: string) => (
    <div className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest mb-2.5">{t}</div>
  );

  if (tab === "overview") return (
    <div className="flex flex-col gap-6 anim-fade-up">
      <div>
        {sectionLabel("Attack Chain Narrative")}
        <p className="text-sm text-secondary leading-relaxed font-medium">{inc.summary}</p>
      </div>
      <div>
        {sectionLabel("Overall Risk Score")}
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-extrabold tracking-tight ${inc.score >= 70 ? "text-critical" : inc.score >= 50 ? "text-high" : "text-medium"}`}>
            {inc.score.toFixed(0)}
          </span>
          <span className="text-sm text-muted font-mono font-medium">/ 100 Risk Index</span>
        </div>
        <div className="progress-track mt-3 h-2.5">
          <div className={`progress-fill ${inc.score >= 70 ? "danger" : inc.score >= 50 ? "warning" : ""}`} style={{ width: `${inc.score}%` }} />
        </div>
      </div>
    </div>
  );

  if (tab === "timeline") return (
    <div className="anim-fade-up">
      {sectionLabel("Sequential Attack Timeline")}
      <IncidentTimeline inc={inc} />
    </div>
  );

  if (tab === "events") return (
    <div className="flex flex-col gap-2.5 anim-fade-up">
      {sectionLabel("Attributed Telemetry Events")}
      {(inc.events ?? []).map((ev, i) => (
        <div key={i} className={`p-3 bg-raised rounded-xl border border-subtle anim-fade-up stagger-${Math.min(i+1,8)}`}>
          <div className="mono dim text-[11px]">{formatTimeShort(ev.event_time)}</div>
          <div className="text-sm font-semibold text-primary mt-1">{ev.description}</div>
        </div>
      ))}
    </div>
  );

  if (tab === "mitre") return (
    <div className="flex flex-col gap-3 anim-fade-up">
      {sectionLabel("Observed MITRE ATT&CK Techniques")}
      {(inc.events ?? []).filter((e) => e.mitre_tactic).length === 0 ? (
        <EmptyState title="No MITRE tactics mapped to this incident" />
      ) : (
        (inc.events ?? []).filter((e) => e.mitre_tactic).map((ev, i) => (
          <div key={i} className={`flex gap-3 items-start p-2.5 rounded-lg bg-raised border border-subtle anim-fade-right stagger-${Math.min(i+1,8)}`}>
            <Badge tone="mitre" dot={false}><Target size={10} /> {ev.mitre_tactic}</Badge>
            <span className="text-xs text-secondary leading-relaxed">{ev.description}</span>
          </div>
        ))
      )}
    </div>
  );

  if (tab === "evidence") return (
    <div className="kv-list anim-fade-up">
      {sectionLabel("Evidence Metadata")}
      <div className="kv-item"><span className="kv-key">Evidence File ID</span><span className="kv-value font-mono font-bold text-accent">#{fileId}</span></div>
      <div className="kv-item"><span className="kv-key">Correlated Events</span><span className="kv-value font-mono font-bold">{inc.events?.length ?? 0}</span></div>
      <div className="kv-item"><span className="kv-key">Severity Level</span>{severityBadge(inc.severity)}</div>
      <div className="kv-item"><span className="kv-key">Risk Score</span><span className="kv-value font-mono font-bold">{inc.score.toFixed(1)}</span></div>
    </div>
  );

  return null;
}

function IncidentSidePanel({ inc, tab }: { inc: IncidentDetail; tab: ITab }) {
  const label = tab === "timeline" ? "Correlation Rationale" : "Attack Sequence Timeline";
  return (
    <div className="border-t md:border-t-0 md:border-l border-subtle md:pl-6 pt-4 md:pt-0">
      <div className="text-[11px] font-mono font-bold text-muted uppercase tracking-widest mb-3">{label}</div>
      {tab === "timeline" ? (
        <div className="anim-fade-up flex flex-col gap-3">
          <p className="text-xs text-secondary leading-relaxed">
            The correlation engine grouped multiple suspicious anomalies across timestamps and origin IPs into a single cohesive attack chain.
          </p>
          <div className="p-3 rounded-lg bg-raised border border-subtle text-xs text-primary font-mono leading-relaxed">
            {inc.summary}
          </div>
        </div>
      ) : (
        <IncidentTimeline inc={inc} compact />
      )}
    </div>
  );
}

function IncidentTimeline({ inc, compact = false }: { inc: IncidentDetail; compact?: boolean }) {
  const events = compact ? (inc.events ?? []).slice(0, 6) : (inc.events ?? []);
  return (
    <div className="incident-timeline">
      {events.map((ev, i) => (
        <div key={i} className={`timeline-event anim-fade-up stagger-${Math.min(i+1,8)}`}>
          <div className={`timeline-event-dot ${(inc.severity ?? "").toLowerCase()}`} />
          <div className="timeline-event-content">
            {!compact && <div className="timeline-event-type">{ev.event_type ?? "Telemetry Event"}</div>}
            <div className="timeline-event-desc">{ev.description}</div>
            <div className="timeline-event-time">{formatTimeShort(ev.event_time)}</div>
            {ev.mitre_tactic && !compact && (
              <div className="mt-1"><Badge tone="mitre" dot={false}><Target size={9} /> {ev.mitre_tactic}</Badge></div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
