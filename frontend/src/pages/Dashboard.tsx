import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Database, HardDrive, Radio,
  ShieldAlert, Target, TrendingUp, Activity,
} from "lucide-react";
import { api, formatTime, formatBytes } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useLiveStream } from "../hooks/useLiveStream";
import { Badge, severityBadge, statusBadge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { StatCard } from "../components/ui/StatCard";
import { Doughnut, LegendList, TrendArea } from "../components/charts";

function slices(r: Record<string, number>) {
  return Object.entries(r).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
}

export function Dashboard() {
  const navigate = useNavigate();
  const overview  = useApi(() => api.overview());
  const riskDist  = useApi(() => api.riskDistribution());
  const logSrc    = useApi(() => api.logSources());
  const mitre     = useApi(() => api.mitreStats());
  const trends    = useApi(() => api.errorTrends());
  const topIps    = useApi(() => api.topIps(8));
  const uploads   = useApi(() => api.uploads(6));
  const { events } = useLiveStream();

  const ov = overview.data;
  const riskData   = slices(riskDist.data ?? {});
  const srcData    = slices(logSrc.data ?? {});
  const mitreData  = slices(mitre.data ?? {});
  const riskTotal  = riskData.reduce((s, d) => s + d.value, 0);
  const srcTotal   = srcData.reduce((s, d) => s + d.value, 0);
  const mitreTotal = mitreData.reduce((s, d) => s + d.value, 0);
  const maxRisk    = Math.max(1, ...(topIps.data ?? []).map((r) => r.score));

  // Merge live events + historical
  const feedItems = events.length > 0
    ? events.slice(0, 10).map((ev) => ({
        id: ev.id, time: ev.timestamp, category: ev.category,
        source: ev.source_ip, reason: ev.reason, severity: ev.severity,
      }))
    : (ov?.recent_events ?? []).slice(0, 10).map((ev) => ({
        id: ev.id, time: ev.created_at, category: ev.risk_category,
        source: ev.source_ip, reason: ev.reason, severity: ev.severity,
      }));

  const loading = overview.loading;

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-header">
        <div className="page-title">
          <h1>Dashboard</h1>
          <p>Real-time forensic signal overview across all evidence</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-secondary" to="/attack-intelligence">
            <Target size={14} /> Attack Library
          </Link>
          <Link className="btn btn-primary" to="/upload">
            <HardDrive size={14} /> Analyze Evidence
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card"><Skeleton /></div>
          ))
        ) : (
          <>
            <StatCard
              label="Total Logs"
              value={ov?.total_logs ?? 0}
              icon={<HardDrive size={14} />}
              foot="Across all evidence files"
            />
            <StatCard
              label="Risk Events"
              value={ov?.risk_events ?? 0}
              icon={<AlertTriangle size={14} />}
              tone={(ov?.risk_events ?? 0) > 0 ? "medium" : "default"}
              foot={`Avg score: ${ov?.average_risk?.toFixed(1) ?? "—"}`}
            />
            <StatCard
              label="Incidents"
              value={ov?.incidents ?? 0}
              icon={<ShieldAlert size={14} />}
              tone={(ov?.incidents ?? 0) > 0 ? "critical" : "default"}
              foot="Correlated attack chains"
            />
            <StatCard
              label="Data Quality"
              value={ov?.quality_score ?? 0}
              icon={<Activity size={14} />}
              tone="ok"
              decimals={1}
              foot={`Health index: ${ov?.health_score?.toFixed(1) ?? "—"}`}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid-2">
        <Card title={<><AlertTriangle size={14} /> Risk Distribution</>}>
          {loading ? <Skeleton /> : riskData.length === 0 ? (
            <EmptyState title="No risk data" hint="Upload evidence to map risk categories." />
          ) : (
            <div className="flex gap-4" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: "46%", minWidth: 180 }}>
                <Doughnut data={riskData} height={200} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <LegendList data={riskData} total={riskTotal} />
              </div>
            </div>
          )}
        </Card>

        <Card title={<><TrendingUp size={14} /> Error Trend (7 days)</>}>
          {loading ? <Skeleton /> : !trends.data || trends.data.values.every((v) => v === 0) ? (
            <EmptyState title="No error trend data" hint="Process evidence to populate the trend chart." />
          ) : (
            <TrendArea labels={trends.data.labels} values={trends.data.values} height={240} />
          )}
        </Card>
      </div>

      {/* Sources + MITRE */}
      <div className="grid-2">
        <Card title={<><Database size={14} /> Log Sources</>}>
          {loading ? <Skeleton /> : srcData.length === 0 ? (
            <EmptyState title="No sources" hint="Log source types will appear after processing." />
          ) : (
            <div className="flex gap-4" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: "46%", minWidth: 160 }}>
                <Doughnut data={srcData} height={180} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <LegendList data={srcData} total={srcTotal} />
              </div>
            </div>
          )}
        </Card>

        <Card title={<><Target size={14} /> MITRE ATT&CK Coverage</>}>
          {loading ? <Skeleton /> : mitreData.length === 0 ? (
            <EmptyState title="No MITRE mappings" hint="Risk events will be mapped to ATT&CK tactics." />
          ) : (
            <div className="flex gap-4" style={{ alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ width: "46%", minWidth: 160 }}>
                <Doughnut data={mitreData} height={180} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <LegendList data={mitreData} total={mitreTotal} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Live feed + Top IPs */}
      <div className="grid-2">
        <Card
          title={<><Radio size={14} /> Live Threat Feed</>}
          actions={
            <Badge tone={events.length > 0 ? "ok" : "default"} dot={events.length > 0}>
              {events.length > 0 ? "streaming" : "idle"}
            </Badge>
          }
        >
          {feedItems.length === 0 ? (
            <EmptyState
              title="Feed is quiet"
              hint="Start the simulated feed from Analyze Evidence to stream live signals."
              action={<Link className="btn btn-secondary btn-sm" to="/upload"><Radio size={12} /> Open Analyze</Link>}
            />
          ) : (
            <div className="live-feed">
              {feedItems.map((ev) => (
                <div key={ev.id} className="live-feed-item">
                  <span className="live-feed-time">{formatTime(ev.time)}</span>
                  <div className="live-feed-content">
                    <div className="live-feed-reason">{ev.reason}</div>
                    <div className="live-feed-meta">{ev.category} · {ev.source ?? "—"}</div>
                  </div>
                  {severityBadge(ev.severity)}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={<><Target size={14} /> Riskiest Source IPs</>}>
          {topIps.loading ? <Skeleton /> : (topIps.data ?? []).length === 0 ? (
            <EmptyState title="No IP data" hint="Processed evidence will rank source IPs by risk score." />
          ) : (
            <div className="flex-col gap-3" style={{ padding: "4px 0" }}>
              {(topIps.data ?? []).map((row) => (
                <div key={row.ip} className="flex items-center gap-3">
                  <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--accent)", width: 110, flexShrink: 0 }}>
                    {row.ip}
                  </span>
                  <div className="risk-bar-wrap" style={{ flex: 1 }}>
                    <div className="risk-bar-track">
                      <div
                        className="risk-bar-fill"
                        style={{ width: `${(row.score / maxRisk) * 100}%`, background: "var(--accent)" }}
                      />
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--text-primary)", width: 36, textAlign: "right" }}>
                    {row.score.toFixed(1)}
                  </span>
                  <span className="mono dim" style={{ fontSize: "var(--text-xs)", width: 52, textAlign: "right" }}>
                    {row.events}ev
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent evidence */}
      <Card
        title={<><HardDrive size={14} /> Recent Evidence</>}
        actions={<Link className="btn btn-ghost btn-sm" to="/upload/history">View all <ArrowRight size={12} /></Link>}
      >
        {uploads.loading ? <Skeleton /> : (uploads.data ?? []).length === 0 ? (
          <EmptyState title="No evidence yet" hint="Upload a log file to begin analysis." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Records</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(uploads.data ?? []).map((row) => (
                  <tr key={row.id} className="table-row-link" onClick={() => navigate(`/logs/${row.id}`)}>
                    <td className="mono">{row.file_name}</td>
                    <td className="mono dim">{formatBytes(row.file_size)}</td>
                    <td className="mono dim">{formatTime(row.upload_time)}</td>
                    <td className="mono">{row.total_records.toLocaleString()}</td>
                    <td>{statusBadge(row.processing_status)}</td>
                    <td style={{ width: 24 }}><ArrowRight size={13} style={{ color: "var(--text-muted)" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent incidents */}
      {(ov?.recent_incidents ?? []).length > 0 && (
        <Card
          title={<><ShieldAlert size={14} /> Recent Incidents</>}
          actions={<Link className="btn btn-ghost btn-sm" to="/incidents">View all <ArrowRight size={12} /></Link>}
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Title</th><th>Severity</th><th>Score</th><th /></tr>
              </thead>
              <tbody>
                {(ov?.recent_incidents ?? []).slice(0, 5).map((inc) => (
                  <tr key={inc.id} className="table-row-link" onClick={() => navigate("/incidents")}>
                    <td>{inc.title}</td>
                    <td>{severityBadge(inc.severity)}</td>
                    <td className="mono" style={{ color: "var(--medium)" }}>{inc.score.toFixed(1)}</td>
                    <td style={{ width: 24 }}><ArrowRight size={13} style={{ color: "var(--text-muted)" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
