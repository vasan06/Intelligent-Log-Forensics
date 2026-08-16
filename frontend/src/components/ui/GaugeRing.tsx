interface GaugeRingProps {
  value: number;
  max?: number;
  caption: string;
  accent?: string;
  size?: number;
  format?: (v: number) => string;
}

export function GaugeRing({ value, max = 100, caption, accent = "#388bfd", size = 90, format }: GaugeRingProps) {
  const r = 36;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value / max));
  const dash = pct * circ;

  return (
    <div className="gauge-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(99,120,150,0.15)" strokeWidth={6} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={accent}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--text-primary)"
          fontSize={13} fontFamily="var(--font-mono)" fontWeight={700} letterSpacing="-0.02em">
          {format ? format(value) : value.toFixed(0)}
        </text>
      </svg>
      <span className="gauge-ring-label">{caption}</span>
    </div>
  );
}
