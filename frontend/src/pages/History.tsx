import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FolderOpen, Search, Upload } from "lucide-react";
import { api, formatTime } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge, statusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
}

function qualityColor(score: number | undefined): string {
  if (score === undefined) return "var(--text-muted)";
  if (score >= 80) return "var(--ok)";
  if (score >= 60) return "var(--medium)";
  return "var(--critical)";
}

export function History() {
  const navigate = useNavigate();
  const uploads = useApi(() => api.uploads(200));
  const [filter, setFilter] = useState("");

  const filtered = (uploads.data ?? []).filter((u) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return u.file_name.toLowerCase().includes(f) || u.file_type.toLowerCase().includes(f);
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right flex items-center gap-2">
            <FolderOpen size={22} className="text-accent" />
            <span>Forensic Evidence Archive</span>
          </h1>
          <p className="anim-fade-right stagger-1">
            Complete cryptographic inventory of ingested log files, quality metrics, and threat findings.
          </p>
        </div>
        <div className="flex items-center gap-3 anim-fade-left">
          {uploads.data && <Badge tone="info" dot={false}>{uploads.data.length} Evidence Files</Badge>}
          <Button variant="primary" icon={<Upload size={14} />} onClick={() => navigate("/upload")} className="hover-glow">
            Ingest New Evidence
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-4 items-center anim-fade-up">
        <div className="input-group max-w-sm">
          <Search size={14} className="input-group-icon" />
          <input
            className="input"
            placeholder="Search by file name or format…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <Card title={<><FolderOpen size={15} /> Verified Evidence Records</>} animate pad="none" flush>
        {uploads.loading ? (
          <div className="p-6"><Skeleton /></div>
        ) : !uploads.data || uploads.data.length === 0 ? (
          <EmptyState
            title="No evidence archived yet"
            hint="Upload your first log evidence file to start forensic analysis."
            action={<Button variant="primary" icon={<Upload size={14} />} onClick={() => navigate("/upload")}>Ingest Log Evidence</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching evidence" hint={`No evidence files match "${filter}".`} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Evidence File</th>
                  <th>Format</th>
                  <th>File Size</th>
                  <th>Ingestion Date</th>
                  <th>Total Records</th>
                  <th>Data Quality</th>
                  <th>Risk Signals</th>
                  <th>Incidents</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`table-row-link anim-fade-up stagger-${Math.min(i % 8 + 1, 8)}`}
                    onClick={() => navigate(`/logs/${row.id}`)}
                  >
                    <td className="mono dim text-xs">#{row.id}</td>
                    <td className="mono font-semibold text-primary">{row.file_name}</td>
                    <td><Badge tone="default" dot={false}>{row.file_type.toUpperCase()}</Badge></td>
                    <td className="mono dim text-xs">{formatSize(row.file_size)}</td>
                    <td className="mono dim text-xs">{formatTime(row.upload_time)}</td>
                    <td className="mono font-semibold">{row.total_records.toLocaleString()}</td>
                    <td className="mono font-bold" style={{ color: qualityColor(row.quality?.quality_score) }}>
                      {row.quality ? `${row.quality.quality_score.toFixed(0)}/100` : "—"}
                    </td>
                    <td>
                      {(row.risk_count ?? 0) > 0 ? (
                        <Badge tone="medium" dot={false}>{row.risk_count}</Badge>
                      ) : (
                        <span className="dim text-xs">—</span>
                      )}
                    </td>
                    <td>
                      {(row.incident_count ?? 0) > 0 ? (
                        <Badge tone="critical" dot={false}>{row.incident_count}</Badge>
                      ) : (
                        <span className="dim text-xs">—</span>
                      )}
                    </td>
                    <td>{statusBadge(row.processing_status)}</td>
                    <td><ArrowRight size={14} className="text-muted" /></td>
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
