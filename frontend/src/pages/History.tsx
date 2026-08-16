import { useNavigate } from "react-router-dom";
import { ArrowRight, FolderOpen, Upload } from "lucide-react";
import { api, formatBytes, formatTime } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge, statusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

export function History() {
  const navigate = useNavigate();
  const uploads = useApi(() => api.uploads(200));

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Evidence Archive</h1>
          <p>All log files you have analyzed, with quality and risk summaries.</p>
        </div>
        <div className="flex items-center gap-3">
          {uploads.data && (
            <Badge tone="info" dot={false}>{uploads.data.length} files</Badge>
          )}
          <Button variant="primary" icon={<Upload size={14} />} onClick={() => navigate("/upload")}>
            Analyze new
          </Button>
        </div>
      </div>

      <Card
        title={<><FolderOpen size={14} /> Evidence files</>}
        pad="none"
        flush
      >
        {uploads.loading ? (
          <Skeleton />
        ) : !uploads.data || uploads.data.length === 0 ? (
          <EmptyState
            title="No evidence uploaded yet"
            hint="Upload a log file to start forensic analysis."
            action={
              <Button variant="primary" icon={<Upload size={14} />} onClick={() => navigate("/upload")}>
                Analyze Evidence
              </Button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>File name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Records</th>
                  <th>Quality</th>
                  <th>Risks</th>
                  <th>Incidents</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {uploads.data.map((row) => (
                  <tr
                    key={row.id}
                    className="table-row-link"
                    onClick={() => navigate(`/logs/${row.id}`)}
                  >
                    <td className="mono dim">{row.id}</td>
                    <td className="mono">{row.file_name}</td>
                    <td className="mono dim">{row.file_type.toUpperCase()}</td>
                    <td className="mono dim">{formatBytes(row.file_size)}</td>
                    <td className="mono dim">{formatTime(row.upload_time)}</td>
                    <td className="mono">{row.total_records.toLocaleString()}</td>
                    <td className="mono" style={{ color: qualityColor(row.quality?.quality_score) }}>
                      {row.quality ? `${row.quality.quality_score.toFixed(0)}` : "—"}
                    </td>
                    <td>
                      {(row.risk_count ?? 0) > 0 ? (
                        <Badge tone="medium" dot={false}>{row.risk_count}</Badge>
                      ) : (
                        <span className="dim" style={{ fontSize: "var(--text-xs)" }}>—</span>
                      )}
                    </td>
                    <td>
                      {(row.incident_count ?? 0) > 0 ? (
                        <Badge tone="critical" dot={false}>{row.incident_count}</Badge>
                      ) : (
                        <span className="dim" style={{ fontSize: "var(--text-xs)" }}>—</span>
                      )}
                    </td>
                    <td>{statusBadge(row.processing_status)}</td>
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

function qualityColor(score: number | undefined): string {
  if (score === undefined) return "var(--text-muted)";
  if (score >= 80) return "var(--ok)";
  if (score >= 60) return "var(--medium)";
  return "var(--critical)";
}
