import { useState } from "react";
import { Activity, CheckCircle, Cpu, Database, Play, Server, Shield, Square, Trash2, UserCog, Users, Zap, ShieldAlert, Layers } from "lucide-react";
import { api, formatTime } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge, statusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StatCard } from "../components/ui/StatCard";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

type AdminTab = "users" | "uploads" | "system" | "database";

export function Admin() {
  const toast    = useToast();
  const [tab, setTab] = useState<AdminTab>("users");
  const overview = useApi(() => api.adminOverview());

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right flex items-center gap-2">
            <Shield size={22} className="text-accent" />
            <span>Platform Administration &amp; System Health</span>
          </h1>
          <p className="anim-fade-right stagger-1">
            Manage authorized analysts, inspect PostgreSQL database telemetry, and control the synthetic threat engine.
          </p>
        </div>
        {overview.data && (
          <Badge tone={overview.data.generator.running ? "ok" : "default"} className="anim-fade-left">
            {overview.data.generator.running ? "Threat Simulator: Active" : "Threat Simulator: Idle"}
          </Badge>
        )}
      </div>

      {overview.loading ? (
        <div className="grid-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="stat-card anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}><Skeleton /></div>)}</div>
      ) : overview.error ? (
        <Card><EmptyState title="Access Denied" hint="Administrator privileges are required to view this console." icon={<Shield size={32} strokeWidth={1.4} />} /></Card>
      ) : overview.data ? (
        <>
          <div className="grid-4">
            <StatCard label="Registered Analysts" value={overview.data.users}   icon={<Users size={18} />}    iconBg="var(--accent-subtle)" iconColor="var(--accent)"  delay={0} />
            <StatCard label="Ingested Evidence"  value={overview.data.uploads} icon={<Server size={18} />}   iconBg="var(--info-bg)"       iconColor="var(--info)"    delay={60} />
            <StatCard label="Normalized Records" value={overview.data.logs}    icon={<Database size={18} />} iconBg="var(--mitre-bg)"      iconColor="var(--mitre)"   delay={120} />
            <StatCard label="Flagged Anomalies"  value={overview.data.risks}   icon={<Activity size={18} />} iconBg="var(--medium-bg)"     iconColor="var(--medium)"  delay={180} />
          </div>
          <GeneratorCard overview={overview.data} toast={toast} onRefresh={overview.refetch} />
        </>
      ) : null}

      {!overview.error && (
        <Card pad="none" flush animate delay={80}>
          <div className="tab-list">
            {(["users", "uploads", "system", "database"] as AdminTab[]).map((t) => (
              <button key={t} className={`tab-trigger${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {t === "users" && "User Accounts"}
                {t === "uploads" && "Evidence Catalog"}
                {t === "system" && "System Configuration"}
                {t === "database" && "PostgreSQL Engine"}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {tab === "users"    && <UsersTab toast={toast} />}
            {tab === "uploads"  && <UploadsTab toast={toast} />}
            {tab === "system"   && <SystemTab data={overview.data} />}
            {tab === "database" && <DatabaseTab />}
          </div>
        </Card>
      )}
    </div>
  );
}

function GeneratorCard({ overview, toast, onRefresh }: { overview: any; toast: any; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      if (overview.generator.running) {
        await api.generatorStop();
        toast("Synthetic generator halted", "info");
      } else {
        await api.generatorStart("normal");
        toast("Synthetic generator started in Normal mode", "success");
      }
      onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally { setBusy(false); }
  }

  return (
    <Card title={<><Cpu size={15} /> PyOD ML Engine &amp; Threat Generator State</>} animate>
      <div className="flex gap-8 flex-wrap items-center justify-between py-1">
        <div className="kv-list flex-1 min-w-[240px]">
          <div className="kv-item">
            <span className="kv-key">Generator Engine</span>
            <Badge tone={overview.generator.running ? "ok" : "default"}>
              {overview.generator.running ? "RUNNING" : "STOPPED"}
            </Badge>
          </div>
          <div className="kv-item"><span className="kv-key">Active Mode</span><span className="kv-value font-mono font-bold text-accent">{overview.generator.mode || "Idle"}</span></div>
          <div className="kv-item"><span className="kv-key">Telemetry File ID</span><span className="kv-value mono text-xs">{overview.generator.upload_id ? `#${overview.generator.upload_id}` : "None"}</span></div>
          <div className="kv-item"><span className="kv-key">Model Weights Artifact</span><span className="kv-value mono text-xs font-semibold text-primary">{overview.model_version ?? "anomaly_ensemble.joblib"}</span></div>
        </div>

        <Button
          variant={overview.generator.running ? "danger" : "primary"}
          icon={overview.generator.running ? <Square size={13} /> : <Play size={13} />}
          loading={busy}
          onClick={toggle}
          className="hover-glow shadow-md px-6 py-2.5"
        >
          {overview.generator.running ? "Halt Threat Generator" : "Start Threat Generator"}
        </Button>
      </div>
    </Card>
  );
}

function UsersTab({ toast }: { toast: any }) {
  const users = useApi(() => api.adminUsers());
  if (users.loading) return <div className="p-4"><Skeleton /></div>;
  if (!users.data?.length) return <EmptyState title="No user accounts registered" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Analyst Name</th>
            <th>Email Address</th>
            <th>RBAC Role</th>
            <th>Account Created</th>
            <th>Last Active</th>
            <th>Status</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          {users.data.map((u, i) => (
            <tr key={u.id} className={`anim-fade-up stagger-${Math.min(i + 1, 8)}`}>
              <td className="font-bold text-primary">{u.name}</td>
              <td className="mono text-xs text-secondary">{u.email}</td>
              <td><Badge tone={u.role === "admin" ? "accent" : "default"} dot={false}>{u.role}</Badge></td>
              <td className="mono dim text-xs">{formatTime(u.created_at)}</td>
              <td className="mono dim text-xs">{formatTime(u.last_login)}</td>
              <td><Badge tone={u.active ? "ok" : "default"} dot={false}>{u.active ? "Active" : "Inactive"}</Badge></td>
              <td>
                <Button variant="ghost" size="sm" onClick={() => toast(`User role permissions · ${u.name}`, "info")}>
                  <UserCog size={13} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UploadsTab({ toast }: { toast: any }) {
  const uploads = useApi(() => api.adminUploads(100));
  if (uploads.loading) return <div className="p-4"><Skeleton /></div>;
  if (!uploads.data?.length) return <EmptyState title="No evidence uploaded" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>File Name</th>
            <th>Format</th>
            <th>Uploaded By</th>
            <th>Timestamp</th>
            <th>Records</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {uploads.data.map((u, i) => (
            <tr key={u.id} className={`anim-fade-up stagger-${Math.min(i + 1, 8)}`}>
              <td className="mono dim text-xs">#{u.id}</td>
              <td className="mono font-semibold text-primary">{u.file_name}</td>
              <td className="mono dim text-xs">{u.file_type?.toUpperCase()}</td>
              <td className="text-xs">{u.owner_name}</td>
              <td className="mono dim text-xs">{formatTime(u.upload_time)}</td>
              <td className="mono font-bold">{(u.total_records ?? 0).toLocaleString()}</td>
              <td>{statusBadge(u.processing_status)}</td>
              <td>
                <button className="btn btn-ghost btn-icon text-muted hover:text-critical" onClick={() => toast(`Evidence retention managed automatically`, "info")}>
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SystemTab({ data }: { data: any }) {
  if (!data) return <EmptyState title="No telemetry available" />;
  const metrics = [
    { label: "Registered Users",       value: data.users },
    { label: "Archived Evidence Files", value: data.uploads },
    { label: "Normalized Log Records",  value: data.logs?.toLocaleString() },
    { label: "Flagged Threat Events",   value: data.risks?.toLocaleString() },
    { label: "Correlated Incidents",    value: data.incidents?.toLocaleString() },
    { label: "Threat Simulator State",  value: data.generator?.running ? "Running" : "Stopped" },
    { label: "Active Simulator Scenario", value: data.generator?.mode || "None" },
    { label: "Telemetry Stream Session", value: data.generator?.upload_id ? `#${data.generator.upload_id}` : "Idle" },
    { label: "Machine Learning Model",  value: data.model_version || "PyOD Anomaly Ensemble v2" },
  ];
  return (
    <div className="flex flex-col gap-2 anim-fade-up max-w-xl">
      {metrics.map((m) => (
        <div key={m.label} className="kv-item py-2.5 border-b border-subtle">
          <span className="kv-key text-xs font-mono">{m.label}</span>
          <span className="kv-value mono text-xs font-bold text-primary">{m.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function DatabaseTab() {
  const db = useApi(() => api.adminDatabase());
  if (db.loading) return <div className="p-4"><Skeleton /></div>;
  if (!db.data) return <EmptyState title="PostgreSQL connection offline" />;
  return (
    <div className="kv-list anim-fade-up max-w-lg py-2">
      <div className="kv-item"><span className="kv-key">Database Engine</span><span className="kv-value font-bold text-accent">PostgreSQL (100% Native)</span></div>
      <div className="kv-item"><span className="kv-key">Database Name</span><span className="kv-value mono text-xs text-primary">{db.data.database}</span></div>
      <div className="kv-item"><span className="kv-key">Connected Role</span><span className="kv-value mono text-xs text-primary">{db.data.user}</span></div>
      <div className="kv-item"><span className="kv-key">Server Version</span><span className="kv-value mono text-xs text-secondary">{db.data.version}</span></div>
      <div className="kv-item">
        <span className="kv-key">Driver Status</span>
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-ok" />
          <span className="text-xs font-bold text-ok font-mono">psycopg2 Connected &amp; Verified</span>
        </div>
      </div>
    </div>
  );
}
