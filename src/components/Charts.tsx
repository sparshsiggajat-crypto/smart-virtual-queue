export function LineChart({ values, sla, unit }: { values: number[]; sla: number; unit: string }) {
  const W = 560, H = 200;
  const data = values.length ? values : [0];
  const max = Math.max(sla + 2, ...data) * 1.1;
  const x = (i: number) => 30 + (i * (W - 44)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - 24 - (v / max) * (H - 40);
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Wait time in ${unit}s`}>
      <path d={`${d} L${x(data.length - 1)} ${H - 24} L${x(0)} ${H - 24}Z`} fill="var(--pri)" opacity=".12" />
      <path d={d} fill="none" stroke="var(--pri)" strokeWidth="3" strokeLinejoin="round" />
      <line x1="30" x2={W - 10} y1={y(sla)} y2={y(sla)} stroke="var(--ter)" strokeDasharray="5 4" />
      <text x={W - 12} y={y(sla) - 5} textAnchor="end">{sla} {unit} target</text>
      <text x="4" y={y(0) + 4}>0</text>
      <text x="4" y={y(max) + 12}>{Math.round(max)}</text>
    </svg>
  );
}

export function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(4, ...values);
  const bw = 300 / values.length;
  return (
    <svg viewBox="0 0 300 200" width="100%" role="img" aria-label="Arrivals over time">
      {values.map((v, i) => {
        const h = (v / max) * 150;
        return (
          <g key={i}>
            <rect x={i * bw + 4} y={176 - h} width={bw - 8} height={h} rx="5" fill={v === max ? "var(--ter)" : "var(--pri)"} opacity={v === max ? 1 : 0.6} />
            <text x={i * bw + bw / 2} y="194" textAnchor="middle">{labels[i]}</text>
            <text x={i * bw + bw / 2} y={170 - h} textAnchor="middle">{v}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function AreaChart({ values, label }: { values: number[]; label: string }) {
  const W = 560, H = 200;
  const data = values.length > 1 ? values : [0, 0];
  const max = Math.max(5, ...data) * 1.15;
  const x = (i: number) => 30 + (i * (W - 44)) / (data.length - 1);
  const y = (v: number) => H - 24 - (v / max) * (H - 40);
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}>
      <path d={`${d} L${x(data.length - 1)} ${H - 24} L${x(0)} ${H - 24}Z`} fill="var(--pri)" opacity=".15" />
      <path d={d} fill="none" stroke="var(--pri)" strokeWidth="2.5" strokeLinejoin="round" />
      <text x="4" y={y(0) + 4}>0</text>
      <text x="4" y={y(max) + 12}>{Math.round(max)}</text>
      <text x={W - 12} y={H - 6} textAnchor="end">{data.length - 1} min</text>
    </svg>
  );
}
