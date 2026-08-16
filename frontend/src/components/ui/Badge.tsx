export type BadgeTone = "critical" | "high" | "medium" | "low" | "ok" | "info" | "mitre" | "default" | "accent";

interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ tone = "default", dot = true, children, className = "" }: BadgeProps) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function severityBadge(severity: string | null | undefined) {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical") return <Badge tone="critical">{severity}</Badge>;
  if (s === "high") return <Badge tone="high">{severity}</Badge>;
  if (s === "medium") return <Badge tone="medium">{severity}</Badge>;
  if (s === "low") return <Badge tone="low">{severity}</Badge>;
  return <Badge tone="default">{severity ?? "unknown"}</Badge>;
}

export function statusBadge(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  if (s === "completed" || s === "complete") return <Badge tone="ok">{status}</Badge>;
  if (s === "processing" || s === "parsing" || s === "analyzing" || s === "normalizing")
    return <Badge tone="medium">{status}</Badge>;
  if (s === "failed") return <Badge tone="critical">{status}</Badge>;
  return <Badge tone="info">{status ?? "unknown"}</Badge>;
}
