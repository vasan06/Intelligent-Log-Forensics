import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ExternalLink, Target, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";


function urgencyTone(u: string): "critical" | "high" | "medium" | "low" | "default" {
  const l = u.toLowerCase();
  if (l === "critical") return "critical";
  if (l === "high") return "high";
  if (l === "medium") return "medium";
  if (l === "low") return "low";
  return "default";
}

export function AttackDetail() {
  const { slug } = useParams();
  const attacks = useApi(() => api.attacks());

  if (attacks.loading) return (
    <div className="page"><Card><Skeleton /></Card></div>
  );

  const attack = attacks.data?.[slug ?? ""];
  if (!attack) return (
    <div className="page">
      <Card>
        <EmptyState
          title="Technique not found"
          hint="This attack pattern is not in the intelligence library."
          icon={<BookOpen size={36} strokeWidth={1.4} />}
          action={<Link className="btn btn-secondary" to="/attack-intelligence"><ArrowLeft size={14} /> Back to library</Link>}
        />
      </Card>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link className="btn btn-ghost btn-sm" to="/attack-intelligence" style={{ marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={13} /> Attack Library
          </Link>
          <h1 style={{ marginTop: 8 }}>{attack.name}</h1>
          <div className="flex gap-2 flex-wrap" style={{ marginTop: 8 }}>
            <Badge tone={urgencyTone(attack.urgency ?? "")} dot={false}>{attack.urgency}</Badge>
            <Badge tone="mitre" dot={false}><Target size={10} /> {attack.mitre}</Badge>
            <Badge tone="info" dot={false}>{attack.tactic}</Badge>
          </div>
        </div>
        {attack.reference && (
          <a href={attack.reference} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            <ExternalLink size={12} /> MITRE ATT&CK <ExternalLink size={11} />
          </a>
        )}
      </div>

      <div className="grid-2">
        <Card title={<><AlertTriangle size={14} /> Overview</>}>
          <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.6, marginBottom: 16 }}>{attack.summary}</p>
          {attack.history && (
            <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.6, color: "var(--text-muted)" }}>{attack.history}</p>
          )}
        </Card>

        <Card title={<><Zap size={14} /> Detection Signals</>}>
          {attack.signals?.length ? (
            <ul className="flex-col gap-2">
              {attack.signals.map((s: string, i: number) => (
                <li key={i} className="flex gap-2" style={{ fontSize: "var(--text-sm)" }}>
                  <span style={{ color: "var(--medium)", flexShrink: 0 }}>·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No signals listed" />}
        </Card>

        <Card title={<><CheckCircle size={14} /> Response Playbook</>}>
          {attack.workflow?.length ? (
            <ol className="flex-col gap-3">
              {attack.workflow.map((step: string, i: number) => (
                <li key={i} className="flex gap-3" style={{ fontSize: "var(--text-sm)" }}>
                  <span className="mono" style={{ fontSize: "var(--text-xs)", color: "var(--accent)", width: 18, flexShrink: 0, paddingTop: 2 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No playbook available" />}
        </Card>

        <Card title="Remediation">
          {attack.solutions?.length ? (
            <ul className="flex-col gap-2">
              {attack.solutions.map((s: string, i: number) => (
                <li key={i} className="flex gap-2" style={{ fontSize: "var(--text-sm)" }}>
                  <CheckCircle size={12} style={{ color: "var(--ok)", flexShrink: 0, marginTop: 2 }} />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No remediation listed" />}
        </Card>
      </div>

      {attack.example && (
        <Card title="Real-world Example">
          <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}>{attack.example}</p>
        </Card>
      )}
    </div>
  );
}
