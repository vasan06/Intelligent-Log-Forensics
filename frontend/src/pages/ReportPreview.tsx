import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Activity, ShieldAlert, CheckCircle, Hash } from "lucide-react";
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
      a.href = url;
      a.download = `forensic-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("Forensic PDF Report generated and downloaded successfully", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "PDF Generation failed", "error");
    } finally { setBusy(false); }
  }

  if (detail.loading) return <div className="page"><Card><Skeleton /></Card></div>;
  if (!upload) return <div className="page"><Card><EmptyState title="Evidence record not found" /></Card></div>;

  const topRisks = (upload.risks ?? []).filter((r) => r.risk_score >= 60)
    .sort((a, b) => b.risk_score - a.risk_score).slice(0, 10);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft size={13} />}
            onClick={() => navigate(`/logs/${id}`)}
            className="anim-fade-right mb-1"
          >
            Back to Evidence Workspace
          </Button>
          <h1 className="anim-fade-right stagger-1 text-2xl font-bold text-primary flex items-center gap-2">
            <FileText size={22} className="text-accent" />
            <span>Forensic Evidence Report Preview</span>
          </h1>
          <p className="anim-fade-right stagger-2 text-xs text-secondary mt-1 font-mono">
            {upload.file_name} · Ingested {formatTime(upload.upload_time)}
          </p>
        </div>

        <Button
          loading={busy}
          icon={<Download size={14} />}
          onClick={download}
          className="hover-glow anim-fade-left shadow-md"
        >
          Download PDF Report
        </Button>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid-4">
        <StatCard label="Records Analyzed" value={upload.total_records} delay={0} />
        <StatCard label="Threat Events" value={upload.risk_count ?? 0} delay={60} />
        <StatCard label="Correlated Incidents" value={upload.incident_count ?? 0} delay={120} />
        <div className="stat-card anim-fade-up" style={{ animationDelay: "180ms" }}>
          <div className="stat-label">Forensic Status</div>
          <div className="mt-3">{statusBadge(upload.processing_status)}</div>
        </div>
      </div>

      {/* Data Quality & Forensic Trust Strip */}
      <Card title={<><Activity size={15} /> Chain-of-Custody &amp; Trust Formula Metrics</>} animate delay={0}>
        <div className="flex gap-8 flex-wrap items-center justify-around py-2">
          <GaugeRing value={upload.quality?.quality_score ?? 0} caption="Data Quality" accent="#16a34a" />
          <GaugeRing value={upload.quality?.health_score ?? 0} caption="Health Index" accent="#388bfd" />
          <GaugeRing value={upload.forensic_trust?.score ?? 0} caption="Forensic Trust" accent="#e3b341" />

          <div className="kv-list flex-1 min-w-[240px] max-w-sm anim-fade-left stagger-3">
            <div className="kv-item"><span className="kv-key">SHA-256 Digest</span><span className="kv-value font-mono text-xs font-semibold text-accent">{shortHash(upload.content_hash)}</span></div>
            <div className="kv-item"><span className="kv-key">Trust Formulation</span><span className="kv-value font-mono text-xs font-semibold text-primary">{upload.forensic_trust?.formula ?? "Weighted Ensemble"}</span></div>
            <div className="kv-item"><span className="kv-key">MITRE ATT&amp;CK Coverage</span><span className="kv-value font-mono font-bold text-mitre">{upload.forensic_trust?.mitre_coverage_rate?.toFixed(0) ?? "—"}%</span></div>
            <div className="kv-item"><span className="kv-key">Duplicate Logs Filtered</span><span className="kv-value font-mono font-bold text-secondary">{upload.quality?.duplicate_logs ?? 0}</span></div>
          </div>
        </div>
      </Card>

      {/* High and Critical Findings Table */}
      <Card title={<><ShieldAlert size={15} /> High &amp; Critical Threat Findings</>} animate delay={80}>
        {topRisks.length === 0 ? (
          <EmptyState title="No high-severity risks identified" hint="All detected anomalies were within nominal baselines." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Risk Score</th>
                  <th>Attack Category</th>
                  <th>MITRE ID</th>
                  <th>Forensic Finding</th>
                  <th>Remediation Action</th>
                </tr>
              </thead>
              <tbody>
                {topRisks.map((risk, i) => (
                  <tr key={risk.id} className={`anim-fade-up stagger-${Math.min(i + 1, 8)}`}>
                    <td>{severityBadge(risk.severity)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-track w-14">
                          <div
                            className={`progress-fill ${risk.risk_score >= 80 ? "danger" : risk.risk_score >= 60 ? "warning" : "ok"}`}
                            style={{ width: `${risk.risk_score}%` }}
                          />
                        </div>
                        <span className="mono text-xs font-bold text-medium">{risk.risk_score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="font-medium text-primary text-xs">{risk.risk_category}</td>
                    <td>
                      {risk.mitre_mapping ? (
                        <Badge tone="mitre" dot={false}>{risk.mitre_mapping.technique_id}</Badge>
                      ) : (
                        <span className="dim text-xs">—</span>
                      )}
                    </td>
                    <td className="max-w-[260px] whitespace-normal text-xs text-secondary leading-relaxed">{risk.reason}</td>
                    <td className="max-w-[220px] whitespace-normal text-xs text-muted leading-relaxed">{risk.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Download Action Card */}
      <Card animate delay={100}>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <p className="text-xs text-secondary leading-relaxed max-w-2xl">
            The exported PDF includes full chain-of-custody cryptographic digests, data quality scores,
            adversary timelines, MITRE ATT&amp;CK matrices, and playbook remediation instructions.
          </p>
          <Button loading={busy} icon={<Download size={14} />} onClick={download} className="hover-glow shrink-0">
            Download PDF Report
          </Button>
        </div>
      </Card>
    </div>
  );
}
