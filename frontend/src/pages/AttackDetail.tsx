import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle, ExternalLink, Target, Zap, ShieldAlert, BookOpen } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

function urgencyTone(u: string): "critical" | "high" | "medium" | "low" | "default" {
  const l = (u ?? "").toLowerCase();
  if (l.includes("immediate") || l.includes("critical")) return "critical";
  if (l.includes("high"))   return "high";
  if (l.includes("medium")) return "medium";
  if (l.includes("low"))    return "low";
  return "default";
}

function normaliseSolutions(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "object") return Object.entries(raw as Record<string, string>).map(([k, v]) => `${k}: ${v}`);
  return [String(raw)];
}

export function AttackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const attacks  = useApi(() => api.attacks());

  if (attacks.loading) return <div className="page"><Card><Skeleton /></Card></div>;

  const attack = attacks.data?.[slug ?? ""];
  if (!attack) return (
    <div className="page">
      <Card>
        <EmptyState
          title="ATT&CK Technique Not Found"
          hint={`"${slug}" is not indexed in the threat intelligence catalog.`}
          icon={<AlertTriangle size={36} strokeWidth={1.4} />}
          action={<Link className="btn btn-secondary" to="/attack-intelligence"><ArrowLeft size={14} /> Back to Catalog</Link>}
        />
      </Card>
    </div>
  );

  const solutions = normaliseSolutions(attack.solutions);

  return (
    <div className="page">
      <div className="page-breadcrumb anim-fade-down">
        <Link to="/attack-intelligence">ATT&amp;CK Catalog</Link>
        <span>›</span>
        <span className="page-breadcrumb-current">{attack.name}</span>
      </div>

      <div className="page-header">
        <div>
          <h1 className="anim-fade-right text-2xl font-bold text-primary mt-1">{attack.name}</h1>
          <div className="flex gap-2 flex-wrap items-center mt-2.5 anim-fade-right stagger-1">
            <Badge tone={urgencyTone(attack.urgency ?? "")} dot={false}>{attack.urgency}</Badge>
            <Badge tone="mitre" dot={false}><Target size={10} /> {attack.mitre}</Badge>
            <Badge tone="info" dot={false}>{attack.tactic}</Badge>
          </div>
        </div>
        {attack.reference && (
          <a
            href={attack.reference}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm anim-fade-left flex items-center gap-1.5"
          >
            <ExternalLink size={13} /> View on MITRE.org
          </a>
        )}
      </div>

      <div className="grid-2">
        <Card title={<><AlertTriangle size={15} /> Threat Summary &amp; Context</>} animate delay={0}>
          <p className="text-sm text-secondary leading-relaxed mb-3">{attack.summary}</p>
          {attack.history && (
            <div className="p-3.5 rounded-xl bg-raised border border-subtle text-xs text-muted leading-relaxed font-mono">
              {attack.history}
            </div>
          )}
        </Card>

        <Card title={<><Zap size={15} /> Forensic Detection Signals</>} animate delay={60}>
          {attack.signals?.length ? (
            <ul className="flex flex-col gap-3">
              {(attack.signals as string[]).map((s, i) => (
                <li key={i} className={`flex gap-3 items-start p-2.5 rounded-lg bg-raised border border-subtle anim-fade-right stagger-${Math.min(i + 1, 8)} text-xs`}>
                  <span className="text-medium font-bold text-sm shrink-0">⚡</span>
                  <span className="text-primary leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No detection signals specified" />}
        </Card>

        <Card title={<><CheckCircle size={15} /> Step-by-Step Response Playbook</>} animate delay={80}>
          {attack.workflow?.length ? (
            <ol className="flex flex-col gap-3">
              {(attack.workflow as string[]).map((step, i) => (
                <li key={i} className={`flex gap-3 items-start p-2.5 rounded-lg bg-raised border border-subtle anim-fade-up stagger-${Math.min(i + 1, 8)} text-xs`}>
                  <span className="mono text-xs font-bold text-accent shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}.</span>
                  <span className="text-primary leading-relaxed font-medium">{step}</span>
                </li>
              ))}
            </ol>
          ) : <EmptyState title="No response playbook available" />}
        </Card>

        <Card title={<><ShieldAlert size={15} /> Hardening &amp; Remediation</>} animate delay={120}>
          {solutions.length ? (
            <ul className="flex flex-col gap-3">
              {solutions.map((s, i) => (
                <li key={i} className={`flex gap-3 items-start p-2.5 rounded-lg bg-raised border border-subtle anim-fade-right stagger-${Math.min(i + 1, 8)} text-xs`}>
                  <CheckCircle size={14} className="text-ok shrink-0 mt-0.5" />
                  <span className="text-primary leading-relaxed">{s}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No remediation steps specified" />}
        </Card>
      </div>

      {attack.example && (
        <Card title={<><BookOpen size={15} /> Real-World Cyber Incident Case Study</>} animate delay={140}>
          <div className="p-4 rounded-xl bg-raised border border-subtle text-xs text-secondary leading-relaxed font-mono">
            {attack.example}
          </div>
        </Card>
      )}
    </div>
  );
}
