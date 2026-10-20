'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inr, num } from '@/lib/format';

/* Chart conventions (see dataviz guidance): thin marks, recessive grid, one
   y-axis, tooltips on everything, text in ink tokens — never series colours. */

export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];
const axis = { fontSize: 11, fill: 'var(--muted)' };
const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

type Fmt = 'inr' | 'num' | 'pct';
const fmt = (v: number, f: Fmt) => (f === 'inr' ? inr(v, { compact: true }) : f === 'pct' ? `${v}%` : num(v));
const fmtFull = (v: number, f: Fmt) => (f === 'inr' ? inr(v) : f === 'pct' ? `${v}%` : num(v));

function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-ink px-3 py-2 text-xs text-white shadow-xl">
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5">
          {r.color && <span className="inline-block h-0.5 w-3" style={{ background: r.color, borderTop: r.dashed ? `2px dashed ${r.color}` : undefined, height: r.dashed ? 0 : 2 }} />}
          <span className="text-white/70">{r.label}</span>
          <span className="ml-auto pl-4 font-semibold tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Tiny trend line for KPI tiles (no axes; tooltip on hover). */
export function Sparkline({ data, dataKey, format = 'num', color = 'var(--chart-1)' }: { data: Record<string, any>[]; dataKey: string; format?: Fmt; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip cursor={false} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={fmtDay(payload[0].payload.bucket)} rows={[{ label: '', value: fmtFull(Number(payload[0].value), format) }]} /> : null)} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#spark-${dataKey})`} dot={false} activeDot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Current vs previous period on one axis — previous is a muted dashed reference line. */
export function TrendChart({ current, previous, dataKey, format = 'inr', height = 280, label = 'This period' }: { current: Record<string, any>[]; previous?: Record<string, any>[]; dataKey: string; format?: Fmt; height?: number; label?: string }) {
  const data = current.map((c, i) => ({ ...c, prev: previous?.[i]?.[dataKey] ?? null, prevBucket: previous?.[i]?.bucket }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`trend-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="bucket" tickFormatter={fmtDay} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickFormatter={(v) => fmt(v, format)} tick={axis} tickLine={false} axisLine={false} width={64} />
        <Tooltip
          cursor={{ stroke: 'var(--faint)', strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload;
            return (
              <TipBox
                title={fmtDay(p.bucket)}
                rows={[
                  { label, value: fmtFull(p[dataKey], format), color: 'var(--chart-1)' },
                  ...(p.prev !== null && p.prev !== undefined ? [{ label: `Previous${p.prevBucket ? ` (${fmtDay(p.prevBucket)})` : ''}`, value: fmtFull(p.prev, format), color: 'var(--chart-muted)', dashed: true }] : []),
                ]}
              />
            );
          }}
        />
        {previous && <Line type="monotone" dataKey="prev" stroke="var(--chart-muted)" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} />}
        <Area type="monotone" dataKey={dataKey} stroke="var(--chart-1)" strokeWidth={2} fill={`url(#trend-${dataKey})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** History + forecast with an 80% confidence band. */
export function ForecastChart({ history, forecast, height = 260 }: { history: { bucket: string; revenue: number }[]; forecast: { bucket: string; revenue: number; low: number; high: number }[]; height?: number }) {
  type Row = { bucket: string; actual?: number; forecast?: number; band?: [number, number] };
  const data: Row[] = history.map((h) => ({ bucket: h.bucket, actual: h.revenue }));
  // Start the forecast line at the last actual point so the two lines join
  const last = data.at(-1);
  if (last && forecast.length) {
    last.forecast = last.actual;
    last.band = [last.actual!, last.actual!];
  }
  data.push(...forecast.map((f) => ({ bucket: f.bucket, forecast: f.revenue, band: [f.low, f.high] as [number, number] })));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="bucket" tickFormatter={fmtDay} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tickFormatter={(v) => inr(v, { compact: true })} tick={axis} tickLine={false} axisLine={false} width={64} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload;
            const rows = p.actual !== undefined ? [{ label: 'Actual', value: inr(p.actual), color: 'var(--chart-1)' }] : [];
            if (p.band && p.actual === undefined) rows.push({ label: 'Forecast', value: inr(p.forecast), color: 'var(--chart-2)' }, { label: 'Likely range', value: `${inr(p.band[0], { compact: true })} – ${inr(p.band[1], { compact: true })}` } as any);
            return <TipBox title={fmtDay(p.bucket)} rows={rows} />;
          }}
        />
        <Area type="monotone" dataKey="band" stroke="none" fill="var(--chart-2)" fillOpacity={0.12} activeDot={false} />
        <Line type="monotone" dataKey="actual" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="forecast" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars with the value printed at the end — best for ranked categories. */
export function HBarList({ items, format = 'inr', color = 'var(--chart-1)' }: { items: { label: string; value: number; sub?: string }[]; format?: Fmt; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} className="group" title={`${i.label}: ${fmtFull(i.value, format)}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {fmt(i.value, format)}
              {i.sub && <span className="ml-1.5 font-normal text-muted">{i.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-tile">
            <div className="h-full rounded-full transition-[width] duration-500 group-hover:opacity-80" style={{ width: `${(i.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars for a single measure over categories. */
export function Bars({ data, x, y, format = 'num', height = 240, colorBy }: { data: Record<string, any>[]; x: string; y: string; format?: Fmt; height?: number; colorBy?: (d: any, i: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} interval={0} />
        <YAxis tickFormatter={(v) => fmt(v, format)} tick={axis} tickLine={false} axisLine={false} width={56} />
        <Tooltip cursor={{ fill: 'var(--tile)' }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={String(payload[0].payload[x])} rows={[{ label: '', value: fmtFull(Number(payload[0].value), format) }]} /> : null)} />
        <Bar dataKey={y} radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorBy ? colorBy(d, i) : 'var(--chart-1)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two series on a shared axis (e.g. new vs returning customers). Legend always shown. */
export function TwoLines({ data, a, b, labels, height = 240 }: { data: Record<string, any>[]; a: string; b: string; labels: [string, string]; height?: number }) {
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-muted">
        {labels.map((l, i) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES[i] }} /> {l}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="bucket" tickFormatter={fmtDay} tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TipBox
                  title={`Week of ${fmtDay(payload[0].payload.bucket)}`}
                  rows={[
                    { label: labels[0], value: num(payload[0].payload[a]), color: SERIES[0] },
                    { label: labels[1], value: num(payload[0].payload[b]), color: SERIES[1] },
                  ]}
                />
              ) : null
            }
          />
          <Line type="monotone" dataKey={a} stroke={SERIES[0]} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey={b} stroke={SERIES[1]} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Weekday × hour heatmap in a single sequential hue. */
export function Heatmap({ grid }: { grid: number[][] }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const max = Math.max(1, ...grid.flat());
  const step = (v: number) => (v === 0 ? 'var(--tile)' : `var(--seq-${Math.min(5, Math.ceil((v / max) * 5))})`);
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-full gap-[2px]" style={{ gridTemplateColumns: `36px repeat(24, minmax(14px, 1fr))` }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[10px] text-muted">
            {h % 3 === 0 ? (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`) : ''}
          </span>
        ))}
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="pr-2 text-right text-[11px] leading-5 text-muted">{days[d]}</span>
            {row.map((v, h) => (
              <span key={h} title={`${days[d]} ${h}:00 — ${v} orders`} className="h-5 rounded-[3px]" style={{ background: step(v) }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
        Fewer
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className="size-3 rounded-[3px]" style={{ background: `var(--seq-${s})` }} />
        ))}
        More orders
      </div>
    </div>
  );
}

/** Funnel as horizontal bars with step conversion. */
export function Funnel({ steps }: { steps: { label: string; count: number; ofTotal: number; fromPrevious: number }[] }) {
  const max = Math.max(1, steps[0]?.count ?? 1);
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{s.label}</span>
            <span className="tabular-nums">
              <b>{num(s.count)}</b>
              <span className="ml-2 text-xs text-muted">{s.ofTotal}%</span>
            </span>
          </div>
          <div className="h-7 rounded-[6px] bg-tile">
            <div className="flex h-full items-center whitespace-nowrap rounded-[6px] px-2 text-[11px] font-semibold text-white" style={{ width: `${Math.max(2, (s.count / max) * 100)}%`, background: 'var(--chart-1)', opacity: 1 - i * 0.1 }}>
              {i > 0 && s.count / max > 0.4 ? `${s.fromPrevious}% from previous step` : ''}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Proportional share bar (stacked single row) with legend — e.g. payment mix, devices. */
export function ShareBar({ items }: { items: { label: string; value: number }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {items.map((i, k) => (
          <span key={i.label} title={`${i.label}: ${Math.round((i.value / total) * 100)}%`} style={{ width: `${(i.value / total) * 100}%`, background: SERIES[k % SERIES.length] }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {items.map((i, k) => (
          <li key={i.label} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: SERIES[k % SERIES.length] }} />
            <span className="capitalize">{i.label}</span>
            <span className="ml-auto tabular-nums text-muted">{Math.round((i.value / total) * 100)}%</span>
            <span className="w-14 text-right font-semibold tabular-nums">{num(i.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
