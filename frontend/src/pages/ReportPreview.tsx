import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Activity } from "lucide-react";
import { api, formatTime, shortHash } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge, severityBadge, statusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { GaugeRing } from "../components/ui/GaugeRing";
import { StatCard } from "../components/ui/StatCard";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

export function ReportPreview() {
  const { fileId } = useParams();
  const id = Number(fileId);
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const detail = useApi(() => api.uploadDetail(id), [id]);
  const upload = detail.data;

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await api.generateReport(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `forensic-report-${id}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      toast("Report downloaded successfully", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Download failed", "error");
    } finally { setBusy(false); }
  }

  if (detail.loading) return <div className="page"><Card><Skeleton /></Card></div>;
  if (!upload) return <div className="page"><Card><EmptyState title="Evidence not found" /></Card></div>;

  const topRisks = (upload.risks ?? []).filter((r) => r.risk_score >= 60)
    .sort((a, b) => b.risk_score - a.risk_score).slice(0, 10);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />}
            onClick={() => navigate(`/logs/${id}`)} className="anim-fade-right">
            Back to explorer
          </Button>
          <h1 className="anim-fade-right stagger-1" style={{ marginTop: 8 }}>Forensic Report</h1>
          <p className="anim-fade-right stagger-2" style={{ fontSize: "var(--text-sm)", marginTop: 4 }}>
            {upload.file_name} · {formatTime(upload.upload_time)}
          </p>
        </div>
        <Button loading={busy} icon={<Download size={14} />} onClick={download} className="hover-glow anim-fade-left">
          Download PDF
        </Button>
      </div>

      <div className="grid-4">
        <StatCard label="Records analyzed" value={upload.total_records} delay={0} />
        <StatCard label="Risk events" value={upload.risk_count ?? 0} delay={60} />
        <StatCard label="Incidents" value={upload.incident_count ?? 0} delay={120} />
        <div className="stat-card anim-fade-up" style={{ animationDelay: "180ms" }}>
          <div className="stat-label">Status</div>
          <div style={{ marginTop: 12 }}>{statusBadge(upload.processing_status)}</div>
        </div>
      </div>

      <Card title={<><Activity size={14} /> Evidence Quality &amp; Forensic Trust</>} animate delay={0}>
        <div className="flex gap-6 flex-wrap" style={{ justifyContent: "space-around" }}>
          <GaugeRing value={upload.quality?.quality_score ?? 0} caption="Data Quality" accent="#16a34a" />
          <GaugeRing value={upload.quality?.health_score ?? 0} caption="Health Index" accent="#4f46e5" />
          <GaugeRing value={upload.forensic_trust?.score ?? 0} caption="Forensic Trust" accent="#d97706" />
          <div className="kv-list anim-fade-left stagger-3" style={{ minWidth: 220 }}>
            <div className="kv-item"><span className="kv-key">SHA-256</span><span className="kv-value mono" style={{ fontSize: "var(--text-xs)" }}>{shortHash(upload.content_hash)}</span></div>
            <div className="kv-item"><span className="kv-key">Trust formula</span><span className="kv-value" style={{ fontSize: "var(--text-xs)" }}>{upload.forensic_trust?.formula ?? "—"}</span></div>
            <div className="kv-item"><span className="kv-key">MITRE coverage</span><span className="kv-value">{upload.forensic_trust?.mitre_coverage_rate?.toFixed(0) ?? "—"}%</span></div>
            <div className="kv-item"><span className="kv-key">Duplicates</span><span className="kv-value">{upload.quality?.duplicate_logs ?? 0}</span></div>
          </div>
        </div>
      </Card>

      <Card title={<><FileText size={14} /> High &amp; Critical Findings</>} animate delay={80}>
        {topRisks.length === 0 ? (
          <EmptyState title="No high-severity findings" hint="All detected risks were below the 60-point threshold." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Severity</th><th>Score</th><th>Category</th><th>MITRE</th><th>Finding</th><th>Action</th></tr></thead>
              <tbody>
                {topRisks.map((risk, i) => (
                  <tr key={risk.id} className={`anim-fade-up stagger-${Math.min(i + 1, 8)}`}>
                    <td>{severityBadge(risk.severity)}</td>
                    <td>
                      <div className="progress-track" style={{ width: 60 }}>
                        <div className={`progress-fill ${risk.risk_score >= 80 ? "danger" : risk.risk_score >= 60 ? "warning" : "ok"}`}
                          style={{ width: `${risk.risk_score}%` }} />
                      </div>
                      <span className="mono" style={{ fontSize: 10 }}>{risk.risk_score.toFixed(0)}</span>
                    </td>
                    <td style={{ fontSize: "var(--text-sm)" }}>{risk.risk_category}</td>
                    <td>
                      {risk.mitre_mapping
                        ? <Badge tone="mitre" dot={false}>{risk.mitre_mapping.technique_id}</Badge>
                        : <span className="dim" style={{ fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ maxWidth: 260, whiteSpace: "normal", fontSize: "var(--text-xs)", lineHeight: 1.4 }}>{risk.reason}</td>
                    <td style={{ maxWidth: 220, whiteSpace: "normal", fontSize: "var(--text-xs)", lineHeight: 1.4, color: "var(--text-muted)" }}>{risk.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card animate delay={100}>
        <div className="flex justify-between items-center">
          <p style={{ fontSize: "var(--text-sm)" }}>
            The PDF contains quality metrics, forensic trust formula, incident timelines, and MITRE ATT&amp;CK mappings with SHA-256 chain-of-custody.
          </p>
          <Button loading={busy} icon={<Download size={14} />} onClick={download} className="hover-glow" style={{ flexShrink: 0, marginLeft: 16 }}>
            Download PDF
          </Button>
        </div>
      </Card>
    </div>
  );
}
