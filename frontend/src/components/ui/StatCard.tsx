import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useInView } from "../../hooks/useInView";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  foot?: ReactNode;
  trend?: string;
  trendUp?: boolean;
  decimals?: number;
  delay?: number;
}

function AnimatedNumber({ target, decimals = 0, duration = 1200 }: { target: number; decimals?: number; duration?: number }) {
  const [val, setVal] = useState(0);
  const frame = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return <>{val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

export function StatCard({ label, value, icon, iconBg, iconColor, foot, trend, trendUp = true, decimals = 0, delay = 0 }: StatCardProps) {
  const { ref, visible } = useInView();

  return (
    <div
      ref={ref}
      className={`stat-card hover-lift${visible ? " anim-fade-up" : ""}`}
      style={{ animationDelay: `${delay}ms`, opacity: visible ? undefined : 0 }}
    >
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        {icon && (
          <div className="stat-icon" style={{ background: iconBg, color: iconColor }}>
            {icon}
          </div>
        )}
      </div>
      <div className="stat-value">
        {visible && typeof value === "number"
          ? <AnimatedNumber target={value} decimals={decimals} />
          : typeof value === "number"
          ? value.toLocaleString()
          : value}
      </div>
      {(foot || trend) && (
        <div className="stat-foot">
          {trend && <span className={trendUp ? "stat-trend-up" : "stat-trend-down"}>{trendUp ? "↑" : "↓"} {trend}</span>}
          {foot && <span>{foot}</span>}
        </div>
      )}
    </div>
  );
}
