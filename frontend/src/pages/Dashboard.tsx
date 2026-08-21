import { Link, useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, Calendar, HardDrive, ShieldAlert, Target, TrendingUp } from "lucide-react";
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
  const uploads  = useApi(() => api.uploads(5));
  const { events } = useLiveStream();
  const chartsRef = useInView();

  const ov = overview.data;
  const mitreData = slices(mitre.data ?? {}).slice(0, 8);
  const maxMitre  = Math.max(1, ...mitreData.map((d) => d.value));

  const feedItems = events.length > 0
    ? events.slice(0, 5).map((ev) => ({ id: ev.id, time: ev.timestamp, reason: ev.reason, severity: ev.severity, category: ev.category }))
    : (ov?.recent_events ?? []).slice(0, 5).map((ev) => ({ id: ev.id, time: ev.created_at, reason: ev.reason, severity: ev.severity, category: ev.risk_category }));

  const STAT_CONFIGS = [
    { label: "Total Logs Processed", value: ov?.total_logs ?? 0, icon: <HardDrive size={18} />, iconBg: "var(--accent-subtle)", iconColor: "var(--accent)", trend: "18.6%", delay: 0 },
    { label: "Risky Events",         value: ov?.risk_events ?? 0, icon: <AlertTriangle size={18} />, iconBg: "var(--high-bg)", iconColor: "var(--high)", trend: "12.3%", delay: 60 },
    { label: "Incidents",            value: ov?.incidents ?? 0, icon: <ShieldAlert size={18} />, iconBg: "var(--critical-bg)", iconColor: "var(--critical)", trend: "7.7%", delay: 120 },
    { label: "Anomalies Detected",   value: (ov?.risk_events ?? 0) + (ov?.incidents ?? 0), icon: <Activity size={18} />, iconBg: "var(--ok-bg)", iconColor: "var(--ok)", trend: "9.1%", delay: 180 },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="anim-fade-right">Dashboard</h1>
          <p className="anim-fade-right stagger-1" style={{ marginTop: 4 }}>Overview of your log analysis environment</p>
        </div>
        <div className="flex items-center gap-3 anim-fade-left">
          <button className="date-chip"><Calendar size={13} /> 11 Aug 2026 – 17 Aug 2026</button>
          <Link className="btn btn-primary hover-glow" to="/upload"><HardDrive size={14} /> Upload Logs</Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-4">
        {overview.loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-card anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="skeleton skeleton-line" style={{ width: "60%" }} />
                <div className="skeleton" style={{ height: 36, marginTop: 10, borderRadius: 6 }} />
              </div>
            ))
          : STAT_CONFIGS.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value}
                icon={s.icon} iconBg={s.iconBg} iconColor={s.iconColor}
                trend={s.trend} delay={s.delay} />
            ))
        }
      </div>

      {/* Charts row */}
      <div ref={chartsRef.ref} className="grid-2">
        <Card title={<><AlertTriangle size={14} /> Risk Level Distribution</>} animate delay={0}>
          <RiskDistPanel visible={chartsRef.visible} />
        </Card>
        <Card title={<><TrendingUp size={14} /> Events Over Time</>} animate delay={80}>
          {trends.loading ? <Skeleton /> : !trends.data ? (
            <EmptyState title="No trend data" />
          ) : (
            <TrendArea labels={trends.data.labels} values={trends.data.values} height={220} />
          )}
        </Card>
      </div>

      {/* MITRE + Alerts */}
      <div className="grid-2">
        <Card title={<><Target size={14} /> Top MITRE ATT&amp;CK Techniques</>} animate delay={0}>
          {mitre.loading ? <Skeleton /> : mitreData.length === 0 ? (
            <EmptyState title="No MITRE data" hint="Upload evidence to populate technique mappings." />
          ) : (
            <div className="flex-col gap-3" style={{ padding: "4px 0" }}>
              {mitreData.map((row, i) => (
                <div key={row.name} className={`flex items-center gap-3 anim-fade-right stagger-${Math.min(i + 1, 8)}`}>
                  <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--accent)", width: 180, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.name}
                  </span>
                  <div className="progress-track" style={{ flex: 1 }}>
                    <div className="progress-fill" style={{ width: `${(row.value / maxMitre) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", color: "var(--text-primary)", width: 36, textAlign: "right", flexShrink: 0 }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={<>
            <ShieldAlert size={14} /> Recent Alerts
            {events.length > 0 && <span className="live-dot-wrap" style={{ marginLeft: 8 }}><span className="live-dot" /></span>}
          </>}
          actions={<Link to="/incidents" className="btn btn-ghost btn-sm">View all <ArrowRight size={12} /></Link>}
          animate delay={80}
        >
          {feedItems.length === 0 ? (
            <EmptyState title="No alerts yet" hint="Start the live feed to stream threat signals." icon={<ShieldAlert size={32} strokeWidth={1.4} />} />
          ) : (
            <div className="live-feed">
              {feedItems.map((ev, i) => (
                <div key={ev.id} className={`live-feed-item anim-fade-up stagger-${Math.min(i + 1, 8)}`}>
                  <div className="live-feed-dot animate-pulse" style={{ background: dotColor(ev.severity) }} />
                  <div className="live-feed-content">
                    <div className="live-feed-reason">{ev.reason}</div>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0, marginLeft: 8 }}>
                    {relativeTime(ev.time)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent uploads */}
      <Card
        title={<><HardDrive size={14} /> Recent Evidence</>}
        actions={<Link className="btn btn-ghost btn-sm" to="/upload/history">View all <ArrowRight size={12} /></Link>}
        animate delay={0}
      >
        {uploads.loading ? <Skeleton /> : (uploads.data ?? []).length === 0 ? (
          <EmptyState title="No evidence uploaded" hint="Upload log files to begin analysis." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>File Name</th><th>Size</th><th>Format</th><th>Status</th><th>Uploaded</th><th /></tr></thead>
              <tbody>
                {(uploads.data ?? []).map((row, i) => (
                  <tr key={row.id} className={`table-row-link anim-fade-up stagger-${Math.min(i + 1, 8)}`} onClick={() => navigate(`/logs/${row.id}`)}>
                    <td>{row.file_name}</td>
                    <td className="dim mono" style={{ fontSize: "var(--text-xs)" }}>{formatSize(row.file_size)}</td>
                    <td><Badge tone="default" dot={false}>{row.file_type.toUpperCase()}</Badge></td>
                    <td>{statusBadge(row.processing_status)}</td>
                    <td className="dim mono" style={{ fontSize: "var(--text-xs)" }}>{formatTime(row.upload_time)}</td>
                    <td><ArrowRight size={13} style={{ color: "var(--text-muted)" }} /></td>
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
  if (total === 0) return <EmptyState title="No risk data" hint="Upload evidence to populate risk distribution." />;

  const COLORS: Record<string, string> = { High: "var(--high)", Critical: "var(--critical)", Medium: "var(--medium)", Low: "var(--low)", Info: "var(--info)" };
  let acc = 0;
  const parts = data.map((d) => {
    const pct = (d.value / total) * 100;
    const col = COLORS[d.name] ?? "var(--info)";
    const start = acc; acc += pct;
    return `${col} ${start.toFixed(1)}% ${acc.toFixed(1)}%`;
  });
  const gradient = `conic-gradient(${parts.join(", ")})`;

  return (
    <div className="flex gap-6 items-center" style={{ flexWrap: "wrap" }}>
      <div style={{
        width: 140, height: 140, borderRadius: "50%", background: gradient, flexShrink: 0,
        boxShadow: "inset 0 0 0 36px var(--bg-surface)",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1) rotate(-90deg)" : "scale(.8) rotate(-90deg)",
        transition: "transform 0.7s cubic-bezier(.22,1,.36,1), opacity 0.5s ease",
      }} />
      <div className="flex-col gap-2" style={{ flex: 1, minWidth: 140 }}>
        {data.map((d, i) => (
          <div key={d.name} className={`flex items-center gap-2 anim-fade-left stagger-${i + 1}`} style={{ fontSize: "var(--text-sm)" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[d.name] ?? "var(--info)", flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--text-secondary)" }}>{d.name}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{((d.value / total) * 100).toFixed(1)}%</span>
            <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", width: 46, textAlign: "right" }}>({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
