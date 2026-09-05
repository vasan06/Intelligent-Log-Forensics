import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Target, ShieldAlert, Zap, Filter } from "lucide-react";
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
  const [selectedTactic, setSelectedTactic] = useState("ALL");
  const gridRef  = useInView();

  const allTactics = useMemo(() => {
    const set = new Set<string>();
    Object.values(attacks.data ?? {}).forEach((a) => {
      if (a.tactic) set.add(a.tactic);
    });
    return Array.from(set);
  }, [attacks.data]);

  const entries = useMemo(() => {
    return Object.entries(attacks.data ?? {})
      .filter(([, a]) => {
        if (selectedTactic !== "ALL" && a.tactic !== selectedTactic) return false;
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
  }, [attacks.data, query, selectedTactic]);

  const total = Object.keys(attacks.data ?? {}).length;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <h1 className="anim-fade-right flex items-center gap-2">
            <Target size={22} className="text-accent" />
            <span>MITRE ATT&amp;CK Threat Intelligence</span>
          </h1>
          <p className="anim-fade-right stagger-1">
            Standardized catalog of adversary techniques, forensic detection signals, and remediation playbooks.
          </p>
        </div>
        {total > 0 && (
          <Badge tone="accent" dot={false} className="anim-fade-left">
            {total} ATT&amp;CK Techniques
          </Badge>
        )}
      </div>

      {/* Search & Filter Controls */}
      <div className="flex gap-4 flex-wrap items-center anim-fade-up">
        <div className="input-group flex-1 min-w-[280px] max-w-md">
          <Search size={14} className="input-group-icon" />
          <input
            className="input"
            placeholder="Search by technique, tactic, summary, or MITRE ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {allTactics.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <button
              onClick={() => setSelectedTactic("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${selectedTactic === "ALL" ? "bg-accent text-white border-accent shadow-sm" : "bg-raised text-secondary border-default hover:bg-surface"}`}
            >
              All Tactics
            </button>
            {allTactics.map((tac) => (
              <button
                key={tac}
                onClick={() => setSelectedTactic(tac)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${selectedTactic === tac ? "bg-accent text-white border-accent shadow-sm" : "bg-raised text-secondary border-default hover:bg-surface"}`}
              >
                {tac}
              </button>
            ))}
          </div>
        )}
      </div>

      {attacks.loading ? (
        <div className="grid-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card anim-fade-up p-5" style={{ animationDelay: `${i * 50}ms` }}>
              <Skeleton />
            </div>
          ))}
        </div>
      ) : entries.length === 0 && total === 0 ? (
        <Card><EmptyState title="No attack intelligence loaded" icon={<Target size={32} strokeWidth={1.4} />} /></Card>
      ) : entries.length === 0 ? (
        <Card><EmptyState title="No matching techniques found" hint={`No techniques match query "${query}".`} icon={<Search size={32} strokeWidth={1.4} />} /></Card>
      ) : (
        <>
          <div className="text-xs text-muted font-mono">
            Showing {entries.length} of {total} techniques {query ? `matching "${query}"` : ""}
          </div>

          <div ref={gridRef.ref} className="grid-3">
            {entries.map(([slug, atk], i) => (
              <Link key={slug} to={`/attack-intelligence/${slug}`} style={{ textDecoration: "none" }}>
                <div
                  className={`glass-card hover-lift p-5 h-full flex flex-col justify-between cursor-pointer ${gridRef.visible ? `anim-fade-up stagger-${Math.min(i + 1, 8)}` : ""}`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <Badge tone={urgencyTone(atk.urgency ?? "")} dot={false}>{atk.urgency ?? "Standard"}</Badge>
                      <Badge tone="mitre" dot={false}><Target size={10} /> {atk.mitre}</Badge>
                    </div>
                    <h4 className="text-base font-bold text-primary mb-2">{atk.name}</h4>
                    <p className="text-xs text-secondary leading-relaxed line-clamp-3 mb-4">{atk.summary}</p>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-subtle">
                    <span className="text-xs text-muted font-mono font-medium">{atk.tactic}</span>
                    <span className="text-xs font-semibold text-accent flex items-center gap-1">
                      Playbook <ArrowRight size={12} className="animate-bounce-x" />
                    </span>
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
