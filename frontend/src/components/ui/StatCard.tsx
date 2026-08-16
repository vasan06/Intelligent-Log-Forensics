import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  foot?: ReactNode;
  tone?: "default" | "critical" | "high" | "medium" | "ok" | "accent";
  decimals?: number;
  mono?: boolean;
}

export function StatCard({ label, value, icon, foot, tone = "default", decimals = 0, mono = false }: StatCardProps) {
  const display = typeof value === "number" ? value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) : value;

  return (
    <div className="stat-card">
      <div className="stat-label">
        <span>{label}</span>
        {icon && <span className="stat-label-icon">{icon}</span>}
      </div>
      <div className={`stat-value ${tone !== "default" ? tone : ""} ${mono ? "mono" : ""}`}>
        {display}
      </div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}
