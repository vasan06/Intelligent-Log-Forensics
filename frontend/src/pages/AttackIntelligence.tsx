import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Target } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

const ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
function tone(u: string): "critical"|"high"|"medium"|"low"|"default" {
  const l = u.toLowerCase();
  return (["critical","high","medium","low"].includes(l) ? l : "default") as any;
}

export function AttackIntelligence() {
  const attacks = useApi(() => api.attacks());
  const [query, setQuery] = useState("");

  const entries = Object.entries(attacks.data ?? {})
    .filter(([, a]) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return a.name.toLowerCase().includes(q) || a.tactic.toLowerCase().includes(q) || a.mitre.toLowerCase().includes(q);
    })
    .sort((a, b) => (ORDER[a[1].urgency?.toLowerCase()] ?? 9) - (ORDER[b[1].urgency?.toLowerCase()] ?? 9) || a[1].name.localeCompare(b[1].name));

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right">Attack Library</h1>
          <p className="anim-fade-right stagger-1">16 attack patterns with detection signals, MITRE mappings, and response playbooks.</p>
        </div>
        <Badge tone="info" dot={false} className="anim-fade-left">{entries.length} techniques</Badge>
      </div>

      <div className="input-group anim-fade-up" style={{ maxWidth: 440 }}>
        <Search size={14} className="input-group-icon" />
        <input className="input" placeholder="Search by name, tactic, or MITRE ID…"
          value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search attacks" />
      </div>

      {attacks.loading ? (
        <div className="grid-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card anim-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="card-body"><Skeleton /></div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card><EmptyState title="No matches" hint="Try a different search term." icon={<Search size={32} strokeWidth={1.4} />} /></Card>
      ) : (
        <div className="grid-3">
          {entries.map(([slug, atk]) => (
            <Link key={slug} to={`/attack-intelligence/${slug}`} style={{ textDecoration: "none" }}>
              <div className="card hover-lift"
                style={{ padding: "var(--sp-4)", cursor: "pointer", height: "100%" }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                  <Badge tone={tone(atk.urgency ?? "")} dot={false}>{atk.urgency}</Badge>
                  <Badge tone="mitre" dot={false}><Target size={9} /> {atk.mitre}</Badge>
                </div>
                <h4 style={{ marginBottom: 5, fontSize: "var(--text-md)" }}>{atk.name}</h4>
                <p style={{ fontSize: "var(--text-xs)", lineHeight: 1.5, WebkitLineClamp: 3, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: 10 }}>
                  {atk.summary}
                </p>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{atk.tactic}</span>
                  <span className="animate-bounce-x" style={{ color: "var(--text-muted)" }}><ArrowRight size={13} /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
