import { Link, useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, HardDrive, ShieldAlert, Target, TrendingUp, Zap } from "lucide-react";
import { api, formatTime } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useLiveStream } from "../hooks/useLiveStream";
import { useInView } from "../hooks/useInView";
import { Badge, statusBadge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { TrendArea } from "../components/charts";

function slices(r: Record<string, number>) {
  return Object.entries(r).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
}
function dotColor(sev: string | null | undefined) {
  const s = (sev ?? "").toLowerCase();
  if (s === "critical") return "var(--critical)";
  if (s === "high")     return "var(--high)";
  if (s === "medium")   return "var(--medium)";
  return "var(--info)";
}
function relativeTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} days ago`;
}
function formatSize(b: number) {
  const mb = b / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(b / 1024).toFixed(1)} KB`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const overview = useApi(() => api.overview());
  const mitre    = useApi(() => api.mitreStats());
  const trends   = useApi(() => api.errorTrends());
  const uploads  = useApi(() => api.uploads(6));
  const { events } = useLiveStream();
  const chartsRef = useInView();

  const ov = overview.data;
  const mitreData = slices(mitre.data ?? {}).slice(0, 8);
  const maxMitre  = Math.max(1, ...mitreData.map((d) => d.value));

  const feedItems = events.length > 0
    ? events.slice(0, 6).map((ev) => ({ id: ev.id, time: ev.timestamp, reason: ev.reason, severity: ev.severity, category: ev.category }))
    : (ov?.recent_events ?? []).slice(0, 6).map((ev) => ({ id: ev.id, time: ev.created_at, reason: ev.reason, severity: ev.severity, category: ev.risk_category }));

  const STAT_CONFIGS = [
    { label: "Total Logs Ingested", value: ov?.total_logs ?? 0, icon: <HardDrive size={18} />, iconBg: "var(--accent-subtle)", iconColor: "var(--accent)", delay: 0 },
    { label: "Risk Signals Flagged", value: ov?.risk_events ?? 0, icon: <AlertTriangle size={18} />, iconBg: "var(--high-bg)", iconColor: "var(--high)", delay: 60 },
    { label: "Correlated Incidents", value: ov?.incidents ?? 0, icon: <ShieldAlert size={18} />, iconBg: "var(--critical-bg)", iconColor: "var(--critical)", delay: 120 },
    { label: "Average Risk Score", value: (ov?.average_risk ?? 0).toFixed(1), icon: <Activity size={18} />, iconBg: "var(--medium-bg)", iconColor: "var(--medium)", delay: 180 },
  ];

  return (
    <div className="page">
      {/* Header Banner */}
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right flex items-center gap-3">
            <span>Operational Forensic Overview</span>
          </h1>
          <p className="anim-fade-right stagger-1">
            Real-time threat detection, anomaly telemetry, and correlated incident analysis.
          </p>
        </div>
        <div className="flex items-center gap-3 anim-fade-left">
          <Link className="btn btn-primary hover-glow" to="/upload">
            <Zap size={14} /> Ingest Log Evidence
          </Link>
        </div>
      </div>

      {/* Primary Real KPI Metric Cards */}
      <div className="grid-4">
        {overview.loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-card anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="skeleton skeleton-line" style={{ width: "60%" }} />
                <div className="skeleton" style={{ height: 38, marginTop: 10, borderRadius: 8 }} />
              </div>
            ))
          : STAT_CONFIGS.map((s) => (
              <StatCard
                key={s.label}
                label={s.label}
                value={s.value}
                icon={s.icon}
                iconBg={s.iconBg}
                iconColor={s.iconColor}
                delay={s.delay}
              />
            ))}
      </div>

      {/* Visual Analytics Grid: Risk Distribution + Event Velocity */}
      <div ref={chartsRef.ref} className="grid-2">
        <Card title={<><AlertTriangle size={15} /> Risk Category Distribution</>} animate delay={0}>
          <RiskDistPanel visible={chartsRef.visible} />
        </Card>

        <Card title={<><TrendingUp size={15} /> 7-Day Error &amp; Anomaly Trends</>} animate delay={80}>
          {trends.loading ? (
            <Skeleton />
          ) : !trends.data || trends.data.labels.length === 0 ? (
            <EmptyState title="No trend data available" hint="Upload and analyze log files to generate time series trends." />
          ) : (
            <TrendArea labels={trends.data.labels} values={trends.data.values} height={230} />
          )}
        </Card>
      </div>

      {/* MITRE ATT&CK Alignment + Real-time Threat Stream */}
      <div className="grid-2">
        <Card
          title={<><Target size={15} /> Observed MITRE ATT&amp;CK Tactics</>}
          actions={<Link to="/attack-intelligence" className="btn btn-ghost btn-sm">Technique Library <ArrowRight size={12} /></Link>}
          animate delay={0}
        >
          {mitre.loading ? (
            <Skeleton />
          ) : mitreData.length === 0 ? (
            <EmptyState title="No MITRE tactics observed" hint="Ingest evidence to correlate adversary tactics." />
          ) : (
            <div className="flex flex-col gap-3 py-1">
              {mitreData.map((row, i) => (
                <div key={row.name} className={`flex items-center gap-3 anim-fade-right stagger-${Math.min(i + 1, 8)}`}>
                  <span className="text-xs font-mono font-semibold text-accent w-44 truncate flex-shrink-0">
                    {row.name}
                  </span>
                  <div className="progress-track flex-1">
                    <div className="progress-fill" style={{ width: `${(row.value / maxMitre) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono font-bold text-primary w-10 text-right flex-shrink-0">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-accent" />
              <span>Telemetry Alert Stream</span>
              {events.length > 0 && <span className="live-dot-wrap ml-1"><span className="live-dot" /></span>}
            </div>
          }
          actions={<Link to="/incidents" className="btn btn-ghost btn-sm">View Incidents <ArrowRight size={12} /></Link>}
          animate delay={80}
        >
          {feedItems.length === 0 ? (
            <EmptyState
              title="No live stream alerts"
              hint="Upload evidence or start the threat generator to stream detections."
              icon={<ShieldAlert size={32} strokeWidth={1.4} />}
            />
          ) : (
            <div className="live-feed">
              {feedItems.map((ev, i) => (
                <div key={ev.id} className={`live-feed-item anim-fade-up stagger-${Math.min(i + 1, 8)}`}>
                  <div className="live-feed-dot" style={{ background: dotColor(ev.severity) }} />
                  <div className="live-feed-content">
                    <div className="live-feed-reason">{ev.reason}</div>
                    <div className="live-feed-meta">
                      {ev.category ? <span className="text-accent font-semibold">{ev.category} · </span> : null}
                      <span className="text-muted">Severity: {ev.severity ?? "Signal"}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted font-mono whitespace-nowrap flex-shrink-0 ml-3">
                    {relativeTime(ev.time)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Forensic Evidence Files Table */}
      <Card
        title={<><HardDrive size={15} /> Recent Ingested Evidence</>}
        actions={<Link className="btn btn-ghost btn-sm" to="/upload/history">Evidence Archive <ArrowRight size={12} /></Link>}
        animate delay={0}
      >
        {uploads.loading ? (
          <Skeleton />
        ) : (uploads.data ?? []).length === 0 ? (
          <EmptyState
            title="No evidence ingested yet"
            hint="Upload log files to begin forensic correlation."
            action={<Link className="btn btn-primary" to="/upload"><HardDrive size={14} /> Ingest Log File</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Total Records</th>
                  <th>Quality Score</th>
                  <th>Risks</th>
                  <th>Status</th>
                  <th>Upload Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(uploads.data ?? []).map((row, i) => (
                  <tr
                    key={row.id}
                    className={`table-row-link anim-fade-up stagger-${Math.min(i + 1, 8)}`}
                    onClick={() => navigate(`/logs/${row.id}`)}
                  >
                    <td className="font-semibold text-primary">{row.file_name}</td>
                    <td><Badge tone="default" dot={false}>{row.file_type.toUpperCase()}</Badge></td>
                    <td className="dim mono text-xs">{formatSize(row.file_size)}</td>
                    <td className="mono font-semibold">{row.total_records.toLocaleString()}</td>
                    <td className="mono font-bold text-accent">
                      {row.quality ? `${row.quality.quality_score.toFixed(0)}/100` : "—"}
                    </td>
                    <td>
                      {(row.risk_count ?? 0) > 0 ? (
                        <Badge tone="high" dot={false}>{row.risk_count}</Badge>
                      ) : (
                        <span className="dim text-xs">—</span>
                      )}
                    </td>
                    <td>{statusBadge(row.processing_status)}</td>
                    <td className="dim mono text-xs">{formatTime(row.upload_time)}</td>
                    <td><ArrowRight size={13} className="text-muted" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function RiskDistPanel({ visible }: { visible: boolean }) {
  const dist = useApi(() => api.riskDistribution());
  if (dist.loading) return <Skeleton />;
  const data = Object.entries(dist.data ?? {}).map(([name, value]) => ({ name, value }));
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyState title="No risk data recorded" hint="Upload evidence to populate risk category breakdown." />;

  const COLORS: Record<string, string> = {
    High: "var(--high)",
    Critical: "var(--critical)",
    Medium: "var(--medium)",
    Low: "var(--low)",
    Info: "var(--info)",
  };
  let acc = 0;
  const parts = data.map((d) => {
    const pct = (d.value / total) * 100;
    const col = COLORS[d.name] ?? "var(--info)";
    const start = acc; acc += pct;
    return `${col} ${start.toFixed(1)}% ${acc.toFixed(1)}%`;
  });
  const gradient = `conic-gradient(${parts.join(", ")})`;

  return (
    <div className="flex gap-8 items-center flex-wrap py-2">
      <div
        style={{
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: gradient,
          flexShrink: 0,
          boxShadow: "inset 0 0 0 30px var(--bg-surface), 0 0 20px rgba(0,0,0,0.15)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) rotate(-90deg)" : "scale(.8) rotate(-90deg)",
          transition: "transform 0.7s cubic-bezier(.22,1,.36,1), opacity 0.5s ease",
        }}
      />
      <div className="flex flex-col gap-2 flex-1 min-w-[160px]">
        {data.map((d, i) => (
          <div key={d.name} className={`flex items-center gap-3 anim-fade-left stagger-${i + 1}`}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[d.name] ?? "var(--info)", flexShrink: 0 }} />
            <span className="flex-1 text-secondary text-sm font-medium">{d.name}</span>
            <span className="text-primary font-bold text-sm">{((d.value / total) * 100).toFixed(1)}%</span>
            <span className="text-muted font-mono text-xs w-12 text-right">({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
