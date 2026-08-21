import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Target, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useInView } from "../hooks/useInView";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

function tone(u: string): "critical"|"high"|"medium"|"low"|"default" {
  const l = (u ?? "").toLowerCase();
  return (["critical","high","medium","low"].includes(l) ? l : "default") as any;
}

export function AttackDetail() {
  const { slug } = useParams();
  const attacks = useApi(() => api.attacks());
  const gridRef = useInView();

  if (attacks.loading) return <div className="page"><Card><Skeleton /></Card></div>;

  const attack = attacks.data?.[slug ?? ""];
  if (!attack) return (
    <div className="page">
      <Card>
        <EmptyState
          title="Technique not found"
          icon={<AlertTriangle size={36} strokeWidth={1.4} />}
          action={<Link className="btn btn-secondary" to="/attack-intelligence"><ArrowLeft size={14} /> Back to library</Link>}
        />
      </Card>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link className="btn btn-ghost btn-sm anim-fade-right" to="/attack-intelligence" style={{ marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={13} /> Attack Library
          </Link>
          <h1 className="anim-fade-right stagger-1" style={{ marginTop: 8 }}>{attack.name}</h1>
          <div className="flex gap-2 flex-wrap anim-fade-right stagger-2" style={{ marginTop: 8 }}>
            <Badge tone={tone(attack.urgency ?? "")} dot={false}>{attack.urgency}</Badge>
            <Badge tone="mitre" dot={false}><Target size={10} /> {attack.mitre}</Badge>
            <Badge tone="info" dot={false}>{attack.tactic}</Badge>
          </div>
        </div>
        {attack.reference && (
          <a href={attack.reference} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm anim-fade-left">
            <ExternalLink size={12} /> MITRE ATT&CK
          </a>
        )}
      </div>

      <div ref={gridRef.ref} className="grid-2">
        <Card title={<><AlertTriangle size={14} /> Overview</>} animate delay={0}>
          <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.7, marginBottom: 14 }}>{attack.summary}</p>
          {attack.history && <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.7, color: "var(--text-muted)" }}>{attack.history}</p>}
        </Card>

        <Card title={<><Zap size={14} /> Detection Signals</>} animate delay={60}>
          {attack.signals?.length ? (
            <ul className="flex-col gap-3">
              {attack.signals.map((s: string, i: number) => (
                <li key={i} className={`flex gap-2 anim-fade-right stagger-${Math.min(i+1,8)}`} style={{ fontSize: "var(--text-sm)" }}>
                  <span style={{ color: "var(--medium)", flexShrink: 0, fontWeight: 700 }}>·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No signals listed" />}
        </Card>

        <Card title={<><CheckCircle size={14} /> Response Playbook</>} animate delay={80}>
          {attack.workflow?.length ? (
            <ol className="flex-col gap-4">
              {attack.workflow.map((step: string, i: number) => (
                <li key={i} className={`flex gap-3 anim-fade-up stagger-${Math.min(i+1,8)}`} style={{ fontSize: "var(--text-sm)" }}>
                  <span className="mono" style={{ fontSize: 10, color: "var(--accent)", width: 20, flexShrink: 0, paddingTop: 2, fontWeight: 700 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ lineHeight: 1.6 }}>{step}</span>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No playbook available" />}
        </Card>

        <Card title="Remediation" animate delay={120}>
          {attack.solutions?.length ? (
            <ul className="flex-col gap-3">
              {attack.solutions.map((s: string, i: number) => (
                <li key={i} className={`flex gap-2 anim-fade-right stagger-${Math.min(i+1,8)}`} style={{ fontSize: "var(--text-sm)" }}>
                  <CheckCircle size={13} style={{ color: "var(--ok)", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ lineHeight: 1.6 }}>{s}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No remediation listed" />}
        </Card>
      </div>

      {attack.example && (
        <Card title="Real-world Example" animate delay={0}>
          <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.7 }}>{attack.example}</p>
        </Card>
      )}
    </div>
  );
}
