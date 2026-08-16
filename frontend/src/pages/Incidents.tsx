import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ShieldAlert, Target } from "lucide-react";
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
          <h1>Incident Tracker</h1>
          <p>Correlated attack chains reconstructed from evidence.</p>
        </div>
        {withIncidents.length > 0 && (
          <Badge tone="critical" dot={false}>{withIncidents.length} files with incidents</Badge>
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
            action={<Link className="btn btn-primary" to="/upload"><ShieldAlert size={14} /> Analyze Evidence</Link>}
          />
        </Card>
      ) : (
        <div className="flex-col gap-4">
          {withIncidents.map((upload) => (
            <Card
              key={upload.id}
              title={<><ShieldAlert size={14} /> {upload.file_name}</>}
              actions={
                <div className="flex gap-2 items-center">
                  <Badge tone="critical" dot={false}>{upload.incident_count} incidents</Badge>
                  <Button variant="secondary" size="sm" icon={<ArrowRight size={12} />}
                    onClick={() => navigate(`/incidents/${upload.id}`)}>
                    View
                  </Button>
                </div>
              }
            >
              <div className="flex gap-4" style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                <span>Uploaded: {formatTime(upload.upload_time)}</span>
                <span>{upload.total_records.toLocaleString()} records</span>
                {upload.risk_count && <span>{upload.risk_count} risks</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FileIncidents({ fileId }: { fileId: number }) {
  const navigate = useNavigate();
  const incidents = useApi(() => api.incidents(fileId), [fileId]);
  const [selected, setSelected] = useState<IncidentDetail | null>(null);

  const data = incidents.data;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate("/incidents")}>
            All incidents
          </Button>
          {data && <h1 style={{ marginTop: 8 }}>{data.file_name}</h1>}
        </div>
        {data && <Badge tone="info" dot={false}>{data.incidents.length} incidents</Badge>}
      </div>

      {incidents.loading ? (
        <Card><Skeleton /></Card>
      ) : !data || data.incidents.length === 0 ? (
        <Card>
          <EmptyState title="No incidents" hint="No correlated attack chains for this evidence." icon={<ShieldAlert size={36} strokeWidth={1.4} />} />
        </Card>
      ) : (
        <div className="grid-2">
          {/* Incident list */}
          <div className="flex-col gap-3">
            {data.incidents.map((inc: IncidentDetail, idx) => (
              <div
                key={inc.id ?? idx}
                className="card"
                style={{
                  padding: "var(--sp-4)",
                  cursor: "pointer",
                  borderColor: selected === inc ? "var(--accent-border)" : undefined,
                  background: selected === inc ? "var(--accent-subtle)" : undefined,
                }}
                onClick={() => setSelected(inc === selected ? null : inc)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setSelected(inc === selected ? null : inc)}
              >
                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  {severityBadge(inc.severity)}
                  <span className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--medium)" }}>
                    {inc.score.toFixed(1)}
                  </span>
                </div>
                <h4 style={{ fontSize: "var(--text-md)", marginBottom: 4 }}>{inc.title}</h4>
                <p style={{ fontSize: "var(--text-xs)" }}>{inc.summary}</p>
                <div style={{ marginTop: 8, fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {inc.events.length} timeline events
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected ? (
            <Card title={<>{severityBadge(selected.severity)} {selected.title}</>} actions={
              <span className="mono" style={{ fontSize: "var(--text-sm)", color: "var(--medium)" }}>{selected.score.toFixed(1)}</span>
            }>
              <p style={{ fontSize: "var(--text-sm)", marginBottom: 16 }}>{selected.summary}</p>
              <div className="incident-timeline">
                {selected.events.map((ev, i) => (
                  <div key={i} className="timeline-event">
                    <div className={`timeline-event-dot ${(selected.severity ?? "").toLowerCase()}`} />
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
            </Card>
          ) : (
            <Card>
              <EmptyState title="Select an incident" hint="Click an incident on the left to view its timeline." icon={<ShieldAlert size={32} strokeWidth={1.4} />} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
