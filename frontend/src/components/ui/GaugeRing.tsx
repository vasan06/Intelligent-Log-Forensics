import { useEffect, useState } from "react";
import { useInView } from "../../hooks/useInView";

interface GaugeRingProps {
  value: number;
  max?: number;
  caption: string;
  accent?: string;
  size?: number;
  format?: (v: number) => string;
}

export function GaugeRing({ value, max = 100, caption, accent = "#4f46e5", size = 90, format }: GaugeRingProps) {
  const { ref, visible } = useInView();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setAnimated(value * eased);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, value]);

  const r = 36;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, animated / max));
  const dash = pct * circ;

  return (
    <div ref={ref} className="gauge-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-raised)" strokeWidth={7} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={accent} strokeWidth={7} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          className="gauge-arc"
        />
        <text x={cx} y={cy + 5} textAnchor="middle"
          fill="var(--text-primary)" fontSize={13}
          fontFamily="var(--font-mono)" fontWeight={700}
          letterSpacing="-0.02em">
          {format ? format(animated) : animated.toFixed(0)}
        </text>
      </svg>
      <span className="gauge-ring-label">{caption}</span>
    </div>
  );
}
