import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Target } from "lucide-react";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { useInView } from "../hooks/useInView";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";

const URGENCY_ORDER: Record<string, number> = { immediate: 0, critical: 1, high: 2, medium: 3, low: 4 };

function urgencyTone(u: string): "critical" | "high" | "medium" | "low" | "default" {
  const l = (u ?? "").toLowerCase();
  if (l.includes("immediate") || l.includes("critical")) return "critical";
  if (l.includes("high"))   return "high";
  if (l.includes("medium")) return "medium";
  if (l.includes("low"))    return "low";
  return "default";
}

export function AttackIntelligence() {
  const attacks  = useApi(() => api.attacks());
  const [query, setQuery] = useState("");
  const gridRef  = useInView();

  const entries = useMemo(() => {
    return Object.entries(attacks.data ?? {})
      .filter(([, a]) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) ||
          (a.tactic ?? "").toLowerCase().includes(q) ||
          (a.mitre ?? "").toLowerCase().includes(q) ||
          (a.summary ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ua = URGENCY_ORDER[(a[1].urgency ?? "").toLowerCase().split(" ")[0]] ?? 9;
        const ub = URGENCY_ORDER[(b[1].urgency ?? "").toLowerCase().split(" ")[0]] ?? 9;
        return ua - ub || a[1].name.localeCompare(b[1].name);
      });
  }, [attacks.data, query]);

  const total = Object.keys(attacks.data ?? {}).length;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right">Attack Library</h1>
          <p className="anim-fade-right stagger-1">
            {total > 0 ? total : "—"} attack patterns with detection signals, MITRE mappings, and response playbooks.
          </p>
        </div>
        {total > 0 && <Badge tone="accent" dot={false} className="anim-fade-left">{total} techniques</Badge>}
      </div>

      <div className="input-group anim-fade-up" style={{ maxWidth: 460 }}>
        <Search size={14} className="input-group-icon" />
        <input className="input" placeholder="Search by name, tactic, or MITRE ID…"
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {attacks.loading ? (
        <div className="grid-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card anim-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="card-body"><Skeleton /></div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 && total === 0 ? (
        <Card><EmptyState title="No attack data" hint="Check the /api/v1/attacks endpoint." icon={<Target size={32} strokeWidth={1.4} />} /></Card>
      ) : entries.length === 0 ? (
        <Card><EmptyState title="No matches" hint={`No techniques match "${query}".`} icon={<Search size={32} strokeWidth={1.4} />} /></Card>
      ) : (
        <>
          {query && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{entries.length} of {total} techniques match "{query}"</div>}
          <div ref={gridRef.ref} className="grid-3">
            {entries.map(([slug, atk], i) => (
              <Link key={slug} to={`/attack-intelligence/${slug}`} style={{ textDecoration: "none" }}>
                <div className={`card hover-lift${gridRef.visible ? ` anim-fade-up stagger-${Math.min(i + 1, 8)}` : ""}`}
                  style={{ padding: "var(--sp-4)", cursor: "pointer", height: "100%", opacity: gridRef.visible ? undefined : 0, display: "flex", flexDirection: "column" }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                    <Badge tone={urgencyTone(atk.urgency ?? "")} dot={false}>{atk.urgency ?? "Unknown"}</Badge>
                    <Badge tone="mitre" dot={false}><Target size={9} /> {atk.mitre}</Badge>
                  </div>
                  <h4 style={{ marginBottom: 4, fontSize: "var(--text-md)" }}>{atk.name}</h4>
                  <p style={{ fontSize: "var(--text-xs)", lineHeight: 1.55, flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", marginBottom: 12 }}>{atk.summary}</p>
                  <div className="flex justify-between items-center">
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{atk.tactic}</span>
                    <ArrowRight size={13} style={{ color: "var(--text-muted)" }} className="animate-bounce-x" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}