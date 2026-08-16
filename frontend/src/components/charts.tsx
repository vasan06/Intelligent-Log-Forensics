import {
  Area, AreaChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar
} from "recharts";

const PALETTE = ["#388bfd", "#3fb950", "#e3b341", "#f85149", "#bc8cff", "#79c0ff", "#58a6ff"];

interface Slice { name: string; value: number; }

function tooltipStyle(): React.CSSProperties {
  return {
    background: "var(--bg-overlay)",
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    fontSize: 11,
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    boxShadow: "var(--shadow-md)",
  };
}

export function Doughnut({ data, height = 220 }: { data: Slice[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="84%" paddingAngle={2} stroke="none">
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle()} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendArea({ labels, values, height = 200 }: { labels: string[]; values: number[]; height?: number }) {
  const data = labels.map((label, i) => ({ label, value: values[i] ?? 0 }));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="aFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#388bfd" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#388bfd" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle()} />
          <Area type="monotone" dataKey="value" stroke="#388bfd" strokeWidth={1.5} fill="url(#aFill)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizBar({ data, height = 200 }: { data: Slice[]; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fill: "var(--text-secondary)", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle()} />
          <Bar dataKey="value" radius={[0, 3, 3, 0]}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LegendList({ data, total }: { data: Slice[]; total: number }) {
  return (
    <div className="flex-col gap-2">
      {data.slice(0, 8).map((slice, i) => (
        <div key={slice.name} className="flex items-center gap-3" style={{ fontSize: "var(--text-xs)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: PALETTE[i % PALETTE.length], flexShrink: 0 }} />
          <span style={{ flex: 1, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slice.name}</span>
          <span className="mono" style={{ color: "var(--text-primary)", flexShrink: 0 }}>
            {slice.value.toLocaleString()}
            {total > 0 && <span style={{ color: "var(--text-muted)" }}> ({((slice.value / total) * 100).toFixed(0)}%)</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
