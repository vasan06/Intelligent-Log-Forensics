import { useState } from "react";
import { Activity, CheckCircle, Cpu, Database, Play, Server, Shield, Square, Users } from "lucide-react";
import { api, formatTime } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge, statusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { StatCard } from "../components/ui/StatCard";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

type AdminTab = "users" | "uploads" | "database";

export function Admin() {
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>("users");
  const overview = useApi(() => api.adminOverview());

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right">Administration</h1>
          <p className="anim-fade-right stagger-1">System overview, user management, and forensic evidence audit.</p>
        </div>
        {overview.data && (
          <Badge tone={overview.data.generator.running ? "ok" : "default"} className="anim-fade-left">
            {overview.data.generator.running ? "Generator running" : "Generator idle"}
          </Badge>
        )}
      </div>

      {overview.loading ? (
        <div className="grid-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="stat-card anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}><Skeleton /></div>)}</div>
      ) : overview.error ? (
        <Card><EmptyState title="Access denied" hint="Administrator role required." icon={<Shield size={32} strokeWidth={1.4} />} /></Card>
      ) : overview.data ? (
        <>
          <div className="grid-4">
            <StatCard label="Total users"    value={overview.data.users}   icon={<Users size={18} />}    iconBg="var(--accent-subtle)"  iconColor="var(--accent)"   delay={0} />
            <StatCard label="Evidence files" value={overview.data.uploads} icon={<Server size={18} />}   iconBg="var(--info-bg)"        iconColor="var(--info)"     delay={60} />
            <StatCard label="Log records"    value={overview.data.logs}    icon={<Database size={18} />} iconBg="var(--mitre-bg)"       iconColor="var(--mitre)"    delay={120} />
            <StatCard label="Risk events"    value={overview.data.risks}   icon={<Activity size={18} />} iconBg="var(--medium-bg)"      iconColor="var(--medium)"   delay={180} />
          </div>
          <GeneratorCard overview={overview.data} toast={toast} onRefresh={overview.refetch} />
        </>
      ) : null}

      {!overview.error && (
        <Card pad="none" flush animate>
          <div className="tab-list">
            {(["users", "uploads", "database"] as AdminTab[]).map((t) => (
              <button key={t} className={`tab-trigger${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="tab-content">
            {tab === "users"    && <UsersTab />}
            {tab === "uploads"  && <UploadsTab />}
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
      if (overview.generator.running) { await api.generatorStop(); toast("Generator stopped", "info"); }
      else { await api.generatorStart("normal"); toast("Generator started in normal mode", "success"); }
      onRefresh();
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setBusy(false); }
  }
  return (
    <Card title={<><Cpu size={14} /> Live Generator &amp; Model</>} animate>
      <div className="flex gap-6 flex-wrap items-center">
        <div className="kv-list" style={{ flex: 1, minWidth: 200 }}>
          <div className="kv-item"><span className="kv-key">Generator status</span>
            <Badge tone={overview.generator.running ? "ok" : "default"}>
              {overview.generator.running
                ? <><span className="live-dot-wrap" style={{ marginRight: 4 }}><span className="live-dot" style={{ width: 6, height: 6 }} /></span> running</>
                : "stopped"}
            </Badge>
          </div>
          <div className="kv-item"><span className="kv-key">Mode</span><span className="kv-value">{overview.generator.mode || "—"}</span></div>
          <div className="kv-item"><span className="kv-key">Model version</span><span className="kv-value mono" style={{ fontSize: 11 }}>{overview.model_version ?? "—"}</span></div>
        </div>
        <Button variant={overview.generator.running ? "danger" : "primary"} icon={overview.generator.running ? <Square size={13} /> : <Play size={13} />} loading={busy} onClick={toggle} className="hover-glow">
          {overview.generator.running ? "Stop generator" : "Start generator"}
        </Button>
      </div>
    </Card>
  );
}

function UsersTab() {
  const users = useApi(() => api.adminUsers());
  if (users.loading) return <Skeleton />;
  if (!users.data?.length) return <EmptyState title="No users" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Last login</th><th>Status</th></tr></thead>
        <tbody>
          {users.data.map((u, i) => (
            <tr key={u.id} className={`anim-fade-up stagger-${Math.min(i + 1, 8)}`}>
              <td>{u.name}</td>
              <td className="mono dim">{u.email}</td>
              <td><Badge tone={u.role === "admin" ? "accent" : "default"} dot={false}>{u.role}</Badge></td>
              <td className="mono dim">{formatTime(u.created_at)}</td>
              <td className="mono dim">{formatTime(u.last_login)}</td>
              <td><Badge tone={u.active ? "ok" : "default"} dot={false}>{u.active ? "Active" : "Inactive"}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UploadsTab() {
  const uploads = useApi(() => api.adminUploads(100));
  if (uploads.loading) return <Skeleton />;
  if (!uploads.data?.length) return <EmptyState title="No uploads" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>File</th><th>Type</th><th>Owner</th><th>Uploaded</th><th>Records</th><th>Status</th></tr></thead>
        <tbody>
          {uploads.data.map((u, i) => (
            <tr key={u.id} className={`anim-fade-up stagger-${Math.min(i + 1, 8)}`}>
              <td className="mono">{u.file_name}</td>
              <td className="mono dim">{u.file_type.toUpperCase()}</td>
              <td>{u.owner_name}</td>
              <td className="mono dim">{formatTime(u.upload_time)}</td>
              <td className="mono">{u.total_records.toLocaleString()}</td>
              <td>{statusBadge(u.processing_status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DatabaseTab() {
  const db = useApi(() => api.adminDatabase());
  if (db.loading) return <Skeleton />;
  if (!db.data) return <EmptyState title="No database info" />;
  return (
    <div className="kv-list anim-fade-up" style={{ maxWidth: 400 }}>
      <div className="kv-item"><span className="kv-key">Database</span><span className="kv-value">{db.data.database}</span></div>
      <div className="kv-item"><span className="kv-key">User</span><span className="kv-value">{db.data.user}</span></div>
      <div className="kv-item"><span className="kv-key">Version</span><span className="kv-value mono" style={{ fontSize: 11 }}>{db.data.version}</span></div>
      <div className="kv-item"><span className="kv-key">Connection</span><CheckCircle size={14} style={{ color: "var(--ok)" }} /></div>
    </div>
  );
}
