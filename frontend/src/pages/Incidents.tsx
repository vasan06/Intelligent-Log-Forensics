import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, FileText, ShieldAlert, Target } from "lucide-react";
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
          <h1 className="anim-fade-right">Incidents</h1>
          <p className="anim-fade-right stagger-1">Correlated attack chains detected across your evidence.</p>
        </div>
        {withIncidents.length > 0 && (
          <Badge tone="critical" dot={false} className="anim-fade-left">{withIncidents.length} files with incidents</Badge>
        )}
      </div>

      {uploads.loading ? (
        <Card><Skeleton /></Card>
      ) : withIncidents.length === 0 ? (
        <Card>
          <EmptyState
            title="No incidents detected"
            hint="Upload and analyze log evidence to detect correlated attack chains."
            icon={<ShieldAlert size={36} strokeWidth={1.4} />}
            action={<Link className="btn btn-primary" to="/upload"><ShieldAlert size={14} /> Upload Evidence</Link>}
          />
        </Card>
      ) : (
        <div className="flex-col gap-3">
          {withIncidents.map((upload) => (
            <div
              key={upload.id}
              className="card hover-lift"
              style={{ padding: "var(--sp-5)", cursor: "pointer" }}
              onClick={() => navigate(`/incidents/${upload.id}`)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                    <ShieldAlert size={15} style={{ color: "var(--critical)" }} />
                    <span style={{ fontWeight: 600 }}>{upload.file_name}</span>
                    <Badge tone="critical" dot={false}>{upload.incident_count} incident{(upload.incident_count ?? 0) > 1 ? "s" : ""}</Badge>
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {upload.total_records.toLocaleString()} records · Uploaded {formatTime(upload.upload_time)}
                  </div>
                </div>
                <ArrowRight size={15} style={{ color: "var(--text-muted)" }} className="animate-bounce-x" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ITab = "overview" | "timeline" | "events" | "mitre" | "evidence" | "recommendations";

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
      <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate("/incidents")} style={{ marginBottom: 8 }}>All Incidents</Button>
      <Card><EmptyState title="No incidents" icon={<ShieldAlert size={36} strokeWidth={1.4} />} /></Card>
    </div>
  );

  const TABS: { id: ITab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Timeline" },
    { id: "events", label: "Events", count: inc?.events?.length },
    { id: "mitre", label: "MITRE ATT&CK", count: inc?.events?.filter((e) => e.mitre_tactic).length },
    { id: "evidence", label: "Evidence" },
    { id: "recommendations", label: "Recommendations" },
  ];

  return (
    <div className="page">
      <div className="page-breadcrumb anim-fade-down">
        <Link to="/incidents">Incidents</Link>
        <span>›</span>
        <span className="page-breadcrumb-current">{inc?.title ?? `File #${fileId}`}</span>
      </div>

      <div className="page-header">
        <h1 className="anim-fade-right">Incident Details</h1>
        {inc && (
          <Link className="btn btn-primary btn-sm hover-glow anim-fade-left" to={`/reports/${fileId}`}>
            <FileText size={13} /> Export Report
          </Link>
        )}
      </div>

      {data.incidents.length > 1 && (
        <Card animate>
          <div className="flex gap-2 flex-wrap">
            {data.incidents.map((i, idx) => (
              <button
                key={idx}
                onClick={() => { setSelected(i); setTab("overview"); }}
                className={`btn btn-sm${selected === i || (selected === null && idx === 0) ? " btn-primary" : " btn-secondary"}`}
              >
                {i.title}
              </button>
            ))}
          </div>
        </Card>
      )}

      {inc && (
        <Card pad="none" flush animate delay={60}>
          {/* Metadata row */}
          <div style={{ padding: "var(--sp-5)", borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="grid-4">
              {[
                { label: "Incident ID", value: `INC-${new Date().getFullYear()}-${String(fileId).padStart(5,"0")}` },
                { label: "Severity", value: severityBadge(inc.severity) },
                { label: "Status", value: <Badge tone="ok">Open</Badge> },
                { label: "Created Time", value: <span className="mono" style={{ fontSize: 12 }}>{formatTime(inc.events?.[0]?.event_time)}</span> },
              ].map((f, i) => (
                <div key={f.label} className={`anim-fade-up stagger-${i+1}`}>
                  <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>{f.label}</div>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="tab-list">
            {TABS.map((t) => (
              <button key={t.id} className={`tab-trigger${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span style={{ background: tab === t.id ? "var(--accent)" : "var(--bg-raised)", color: tab === t.id ? "#fff" : "var(--text-muted)", borderRadius: "var(--r-full)", fontSize: 9, fontWeight: 700, padding: "1px 6px", marginLeft: 4 }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-6)", padding: "var(--sp-5)", animation: "fadeIn 200ms ease both" }}>
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
    <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>{t}</div>
  );
  if (tab === "overview") return (
    <div className="flex-col gap-5 anim-fade-up">
      <div>{sectionLabel("Description")}<p style={{ fontSize: "var(--text-sm)", lineHeight: 1.7 }}>{inc.summary}</p></div>
      <div>
        {sectionLabel("Risk Score")}
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-.03em", color: inc.score >= 70 ? "var(--critical)" : inc.score >= 50 ? "var(--high)" : "var(--medium)", lineHeight: 1 }}>
          {inc.score.toFixed(0)}<span style={{ fontSize: 16, color: "var(--text-muted)", fontWeight: 400 }}> / 100</span>
        </div>
        <div className="progress-track" style={{ marginTop: 10, height: 8 }}>
          <div className={`progress-fill ${inc.score >= 70 ? "danger" : inc.score >= 50 ? "warning" : ""}`} style={{ width: `${inc.score}%` }} />
        </div>
      </div>
    </div>
  );
  if (tab === "timeline") return (
    <div className="anim-fade-up">
      {sectionLabel("Incident Timeline")}
      <IncidentTimeline inc={inc} />
    </div>
  );
  if (tab === "events") return (
    <div className="flex-col gap-2 anim-fade-up">
      {(inc.events ?? []).map((ev, i) => (
        <div key={i} className={`anim-fade-up stagger-${Math.min(i+1,8)}`} style={{ padding: "var(--sp-3)", background: "var(--bg-raised)", borderRadius: "var(--r-lg)", border: "1px solid var(--border-subtle)" }}>
          <div className="mono dim" style={{ fontSize: 11 }}>{formatTimeShort(ev.event_time)}</div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 500, marginTop: 3 }}>{ev.description}</div>
        </div>
      ))}
    </div>
  );
  if (tab === "mitre") return (
    <div className="flex-col gap-3 anim-fade-up">
      {(inc.events ?? []).filter((e) => e.mitre_tactic).length === 0
        ? <EmptyState title="No MITRE data" />
        : (inc.events ?? []).filter((e) => e.mitre_tactic).map((ev, i) => (
            <div key={i} className={`flex gap-3 items-start anim-fade-right stagger-${Math.min(i+1,8)}`}>
              <Badge tone="mitre" dot={false}><Target size={9} /> {ev.mitre_tactic}</Badge>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>{ev.description}</span>
            </div>
          ))}
    </div>
  );
  if (tab === "evidence") return (
    <div className="kv-list anim-fade-up">
      <div className="kv-item"><span className="kv-key">File</span><span className="kv-value mono" style={{ fontSize: 11 }}>#{fileId}</span></div>
      <div className="kv-item"><span className="kv-key">Events</span><span className="kv-value">{inc.events?.length ?? 0}</span></div>
      <div className="kv-item"><span className="kv-key">Severity</span>{severityBadge(inc.severity)}</div>
      <div className="kv-item"><span className="kv-key">Score</span><span className="kv-value">{inc.score.toFixed(1)}</span></div>
    </div>
  );
  if (tab === "recommendations") return (
    <div className="flex-col gap-3 anim-fade-up">
      <div className="alert alert-warning"><span style={{ fontSize: 13 }}>Review affected systems and reset compromised credentials immediately.</span></div>
      {["Isolate the affected host from the network.", "Reset all credentials for impacted accounts.", "Review and rotate API keys and secrets.", "Enable enhanced logging on affected systems.", "Perform a full forensic review before restoring service."].map((r, i) => (
        <div key={i} className={`flex gap-3 anim-fade-right stagger-${Math.min(i+1,8)}`} style={{ fontSize: "var(--text-sm)" }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, flexShrink: 0, paddingTop: 2 }}>{String(i+1).padStart(2,"0")}.</span>
          <span style={{ lineHeight: 1.6 }}>{r}</span>
        </div>
      ))}
    </div>
  );
  return null;
}

function IncidentSidePanel({ inc, tab }: { inc: IncidentDetail; tab: ITab }) {
  const label = tab === "timeline" ? "AI Explanation" : "Incident Timeline";
  return (
    <div style={{ borderLeft: "1px solid var(--border-subtle)", paddingLeft: "var(--sp-6)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14 }}>{label}</div>
      {tab === "timeline" ? (
        <div className="anim-fade-up">
          <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.7, marginBottom: 12 }}>
            The system detected suspicious patterns across multiple log entries. Indicators of compromise were correlated and attributed to a single attack chain.
          </p>
          <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.7, color: "var(--text-muted)" }}>{inc.summary}</p>
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
            {!compact && <div className="timeline-event-type">{ev.event_type ?? "Event"}</div>}
            <div className="timeline-event-desc" style={{ fontSize: compact ? "var(--text-xs)" : undefined }}>{ev.description}</div>
            <div className="timeline-event-time">{formatTimeShort(ev.event_time)}</div>
            {ev.mitre_tactic && !compact && (
              <div style={{ marginTop: 4 }}><Badge tone="mitre" dot={false}><Target size={9} /> {ev.mitre_tactic}</Badge></div>
            )}
          </div>
        </div>
      ))}
      {compact && (inc.events?.length ?? 0) > 6 && (
        <div style={{ paddingLeft: 28, fontSize: "var(--text-xs)", color: "var(--accent)", cursor: "pointer", marginTop: 8 }}>View Full Timeline →</div>
      )}
    </div>
  );
}
