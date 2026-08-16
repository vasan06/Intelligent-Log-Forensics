import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function urgencyTone(u: string): "critical" | "high" | "medium" | "low" | "default" {
  const l = u.toLowerCase();
  if (l === "critical") return "critical";
  if (l === "high") return "high";
  if (l === "medium") return "medium";
  if (l === "low") return "low";
  return "default";
}

export function AttackIntelligence() {
  const attacks = useApi(() => api.attacks());
  const [query, setQuery] = useState("");

  const entries = Object.entries(attacks.data ?? {})
    .filter(([, atk]) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        atk.name.toLowerCase().includes(q) ||
        atk.tactic.toLowerCase().includes(q) ||
        atk.mitre.toLowerCase().includes(q) ||
        (atk.summary ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const ua = URGENCY_ORDER[a[1].urgency?.toLowerCase()] ?? 9;
      const ub = URGENCY_ORDER[b[1].urgency?.toLowerCase()] ?? 9;
      return ua - ub || a[1].name.localeCompare(b[1].name);
    });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1>Attack Library</h1>
          <p>16 attack patterns with detection signals, MITRE mappings, and response playbooks.</p>
        </div>
        <Badge tone="info" dot={false}>{entries.length} techniques</Badge>
      </div>

      {/* Search */}
      <div className="input-group" style={{ maxWidth: 420 }}>
        <Search size={14} className="input-group-icon" />
        <input
          className="input"
          placeholder="Search by name, tactic, or MITRE ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search attacks"
        />
      </div>

      {attacks.loading ? (
        <div className="grid-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><Skeleton /></Card>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            title="No matches"
            hint="Try a different search term."
            icon={<Search size={32} strokeWidth={1.4} />}
          />
        </Card>
      ) : (
        <div className="grid-3">
          {entries.map(([slug, atk]) => (
            <Link key={slug} to={`/attack-intelligence/${slug}`} style={{ textDecoration: "none" }}>
              <div className="card" style={{
                padding: "var(--sp-4)",
                cursor: "pointer",
                transition: "border-color var(--t-fast), background var(--t-fast)",
                height: "100%",
              }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "";
                }}
              >
                <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                  <Badge tone={urgencyTone(atk.urgency ?? "")} dot={false}>{atk.urgency}</Badge>
                  <Badge tone="mitre" dot={false}>{atk.mitre}</Badge>
                </div>
                <h4 style={{ marginBottom: 4 }}>{atk.name}</h4>
                <p style={{ fontSize: "var(--text-xs)", marginBottom: 10, WebkitLineClamp: 3, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {atk.summary}
                </p>
                <div className="flex justify-between items-center">
                  <span className="dim" style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)" }}>{atk.tactic}</span>
                  <ArrowRight size={13} style={{ color: "var(--text-muted)" }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
