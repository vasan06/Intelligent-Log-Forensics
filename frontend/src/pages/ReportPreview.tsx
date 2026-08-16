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
      toast("Report downloaded", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Download failed", "error");
    } finally { setBusy(false); }
  }

  if (detail.loading) return <div className="page"><Card><Skeleton /></Card></div>;

  if (!upload) return (
    <div className="page">
      <Card>
        <EmptyState title="Evidence not found" hint="The file may have been removed." />
      </Card>
    </div>
  );

  const topRisks = (upload.risks ?? [])
    .filter((r) => r.risk_score >= 60)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 10);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate(`/logs/${id}`)}>
            Back to explorer
          </Button>
          <h1 style={{ marginTop: 8 }}>Forensic Report</h1>
          <p style={{ marginTop: 4, fontSize: "var(--text-sm)" }}>
            {upload.file_name} · {formatTime(upload.upload_time)}
          </p>
        </div>
        <Button loading={busy} icon={<Download size={14} />} onClick={download}>
          Download PDF
        </Button>
      </div>

      {/* Summary metrics */}
      <div className="grid-4">
        <div className="stat-card">
          <div className="stat-label">Records analyzed</div>
          <div className="stat-value">{upload.total_records.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Risk events</div>
          <div className="stat-value medium">{(upload.risk_count ?? 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Incidents</div>
          <div className="stat-value critical">{(upload.incident_count ?? 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Status</div>
          <div className="stat-value" style={{ fontSize: "var(--text-md)", paddingTop: 6 }}>
            {statusBadge(upload.processing_status)}
          </div>
        </div>
      </div>

      {/* Trust scores */}
      <Card title={<><Activity size={14} /> Evidence Quality &amp; Forensic Trust</>}>
        <div className="flex gap-6 flex-wrap" style={{ justifyContent: "space-around" }}>
          <GaugeRing value={upload.quality?.quality_score ?? 0} caption="Data Quality" accent="#3fb950" />
          <GaugeRing value={upload.quality?.health_score ?? 0} caption="Health Index" accent="#388bfd" />
          <GaugeRing value={upload.forensic_trust?.score ?? 0} caption="Forensic Trust" accent="#e3b341" />
          <div className="kv-list" style={{ minWidth: 220 }}>
            <div className="kv-item">
              <span className="kv-key">SHA-256</span>
              <span className="kv-value" style={{ fontSize: "var(--text-xs)" }}>{shortHash(upload.content_hash)}</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Trust formula</span>
              <span className="kv-value" style={{ fontSize: "var(--text-xs)" }}>{upload.forensic_trust?.formula ?? "—"}</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">MITRE coverage</span>
              <span className="kv-value">{upload.forensic_trust?.mitre_coverage_rate?.toFixed(0) ?? "—"}%</span>
            </div>
            <div className="kv-item">
              <span className="kv-key">Duplicates</span>
              <span className="kv-value">{upload.quality?.duplicate_logs ?? 0}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Top findings */}
      <Card title={<><FileText size={14} /> High &amp; Critical Findings (top 10 by score)</>}>
        {topRisks.length === 0 ? (
          <EmptyState title="No high-severity findings" hint="All detected risks were below the 60-point threshold." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Severity</th><th>Score</th><th>Category</th><th>MITRE</th><th>Finding</th><th>Action</th></tr>
              </thead>
              <tbody>
                {topRisks.map((risk) => (
                  <tr key={risk.id}>
                    <td>{severityBadge(risk.severity)}</td>
                    <td className="mono" style={{ color: "var(--medium)" }}>{risk.risk_score.toFixed(0)}</td>
                    <td style={{ fontSize: "var(--text-sm)" }}>{risk.risk_category}</td>
                    <td>
                      {risk.mitre_mapping ? (
                        <div className="flex-col gap-1">
                          <Badge tone="mitre" dot={false}>{risk.mitre_mapping.technique_id}</Badge>
                          <span className="dim" style={{ fontSize: "var(--text-xs)" }}>{risk.mitre_mapping.tactic}</span>
                        </div>
                      ) : <span className="dim" style={{ fontSize: "var(--text-xs)" }}>—</span>}
                    </td>
                    <td style={{ maxWidth: 300, whiteSpace: "normal", fontSize: "var(--text-xs)", lineHeight: 1.4 }}>
                      {risk.reason}
                    </td>
                    <td style={{ maxWidth: 250, whiteSpace: "normal", fontSize: "var(--text-xs)", lineHeight: 1.4, color: "var(--text-muted)" }}>
                      {risk.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex-col gap-3" style={{ alignItems: "flex-start" }}>
          <p style={{ fontSize: "var(--text-sm)" }}>
            The downloadable PDF contains quality metrics, forensic trust formula, the findings above, incident timelines, and MITRE ATT&CK mappings. Evidence hash is embedded for chain-of-custody documentation.
          </p>
          <Button loading={busy} icon={<Download size={14} />} onClick={download}>
            Download PDF report
          </Button>
        </div>
      </Card>
    </div>
  );
}
