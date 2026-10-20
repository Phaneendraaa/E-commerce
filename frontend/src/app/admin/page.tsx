'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, MessageSquare, Package, RotateCcw, Star, Warehouse } from 'lucide-react';
import { inr, num, timeAgo } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';
import { Delta, ErrorNote, Loading, PageHeader, Panel, RangePicker, Table, useApi } from '@/components/admin/kit';
import { ForecastChart, Funnel, HBarList, Sparkline, TrendChart } from '@/components/admin/charts';
import { StatusBadge } from '@/components/store/OrderBits';
import { Img } from '@/components/ui';

type KPI = Record<string, number>;
interface Overview {
  range: { from: string; to: string; days: number };
  current: KPI;
  previous: KPI;
  change: KPI;
  spark: { bucket: string; revenue: number; orders: number; aov: number; customers: number; profit: number }[];
}

const TILES: { key: string; label: string; format: 'inr' | 'num' | 'pct'; spark?: string; invert?: boolean; hint?: string }[] = [
  { key: 'revenue', label: 'Revenue', format: 'inr', spark: 'revenue', hint: 'Valid orders, incl. GST & shipping' },
  { key: 'orders', label: 'Orders', format: 'num', spark: 'orders' },
  { key: 'aov', label: 'Average order value', format: 'inr', spark: 'aov' },
  { key: 'grossProfit', label: 'Gross profit', format: 'inr', spark: 'profit', hint: 'Item revenue − discounts − cost' },
  { key: 'conversionRate', label: 'Conversion rate', format: 'pct', hint: 'Sessions that purchased' },
  { key: 'newCustomers', label: 'New customers', format: 'num' },
  { key: 'returningRate', label: 'Returning buyers', format: 'pct', hint: 'Buyers who had ordered before' },
  { key: 'cancellationRate', label: 'Cancellation rate', format: 'pct', invert: true },
];

const fmt = (v: number, f: 'inr' | 'num' | 'pct') => (f === 'inr' ? inr(v, { compact: true }) : f === 'pct' ? `${v}%` : num(v));

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const ov = useApi<Overview>('/admin/analytics/overview', { days });
  const sales = useApi<{ current: any[]; previous: any[]; granularity: string }>('/admin/analytics/sales', { days });
  const fc = useApi<{ history: any[]; forecast: any[]; projectedTotal: number; trendPerDay: number }>('/admin/analytics/forecast');
  const rt = useApi<any>('/admin/analytics/realtime');
  const funnel = useApi<{ steps: any[]; cartAbandonment: number; checkoutAbandonment: number }>('/admin/analytics/funnel', { days });
  const cats = useApi<{ category: string; revenue: number; share: number }[]>('/admin/analytics/categories', { days });
  const top = useApi<any[]>('/admin/analytics/products', { days, limit: 6 });

  const actions = rt.data?.actionItems;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={ov.data ? `Compared with the previous ${ov.data.range.days} days` : 'Store performance at a glance'}
        actions={<RangePicker days={days} onChange={setDays} />}
      />

      {/* Live strip */}
      {rt.data && (
        <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[var(--radius)] bg-ink px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#1baf7a] opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[#1baf7a]" />
            </span>
            <span className="text-sm text-white/70">Live now</span>
            <b className="font-display text-xl">{rt.data.activeSessions}</b>
            <span className="text-sm text-white/70">visitors · {rt.data.inCheckout} in checkout</span>
          </div>
          <div className="text-sm text-white/70">
            Today <b className="ml-1 font-display text-xl text-white">{inr(rt.data.today.revenue, { compact: true })}</b> from {rt.data.today.orders} orders
          </div>
          <Link href="/admin/orders?status=CONFIRMED,PROCESSING,PACKED" className="ml-auto rounded-full bg-marigold px-3.5 py-1.5 text-sm font-semibold text-ink">
            {actions?.toShip ?? 0} orders to ship
          </Link>
        </div>
      )}

      {ov.error && <ErrorNote message={ov.error} onRetry={ov.reload} />}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.key} className="rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line" title={t.hint}>
            <div className="text-xs font-medium text-muted">{t.label}</div>
            {ov.data ? (
              <>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-[26px] font-bold tabular-nums">{fmt(ov.data.current[t.key], t.format)}</span>
                  <Delta value={ov.data.change[t.key]} invert={t.invert} />
                </div>
                {t.key === 'grossProfit' && <div className="text-xs text-muted">{ov.data.current.margin}% margin</div>}
                {t.spark ? <Sparkline data={ov.data.spark} dataKey={t.spark} format={t.format} /> : <div className="mt-1 text-xs text-muted">was {fmt(ov.data.previous[t.key], t.format)}</div>}
              </>
            ) : (
              <div className="skeleton mt-2 h-16" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Revenue"
          description={`By ${sales.data?.granularity ?? 'day'} · dashed line is the previous period`}
          actions={ov.data && <span className="font-display text-xl font-bold">{inr(ov.data.current.revenue)}</span>}
        >
          {sales.data ? <TrendChart current={sales.data.current} previous={sales.data.previous} dataKey="revenue" /> : <Loading />}
        </Panel>
        <Panel title="Needs attention" description="Work queue across the store">
          {actions ? (
            <ul className="divide-y divide-line">
              {[
                { href: '/admin/orders?status=CONFIRMED,PROCESSING,PACKED', icon: Package, label: 'Orders to ship', value: actions.toShip },
                { href: '/admin/returns', icon: RotateCcw, label: 'Return requests', value: actions.returnRequests },
                { href: '/admin/reviews', icon: Star, label: 'Reviews to moderate', value: actions.pendingReviews },
                { href: '/admin/reviews?tab=questions', icon: MessageSquare, label: 'Unanswered questions', value: actions.unansweredQuestions },
                { href: '/admin/inventory', icon: Warehouse, label: 'Low or out of stock', value: actions.lowStock },
              ].map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="flex items-center gap-3 py-3 text-sm hover:text-ink-soft">
                    <a.icon size={18} className="text-muted" />
                    <span className="flex-1">{a.label}</span>
                    <span className={`min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-bold ${a.value ? 'bg-marigold-soft text-[#8a5d00]' : 'bg-tile text-muted'}`}>{a.value}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Loading />
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Revenue forecast"
          description="Next 14 days · trend with weekday seasonality, shaded band is the likely range"
          actions={fc.data && <span className="text-right text-sm text-muted">Projected <b className="font-display text-lg text-ink">{inr(fc.data.projectedTotal, { compact: true })}</b></span>}
        >
          {fc.data ? (
            fc.data.forecast.length ? (
              <>
                <div className="mb-2 flex gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4" style={{ background: 'var(--chart-1)' }} /> Actual
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--chart-2)' }} /> Forecast
                  </span>
                </div>
                <ForecastChart history={fc.data.history} forecast={fc.data.forecast} />
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted">Need at least two weeks of sales to forecast.</p>
            )
          ) : (
            <Loading />
          )}
        </Panel>
        <Panel title="Conversion funnel" description={funnel.data ? `${funnel.data.cartAbandonment}% of carts don’t convert` : undefined}>
          {funnel.data ? <Funnel steps={funnel.data.steps} /> : <Loading />}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Top products" description="By revenue in this period" padded={false} actions={<Link href="/admin/analytics?tab=products" className="text-sm font-semibold underline underline-offset-4">All products</Link>}>
          {top.data ? (
            <Table head={['Product', 'Units', 'Revenue', 'Margin', 'Views → orders']}>
              {top.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:underline">
                      <Img src={p.image} alt="" className="size-9 rounded-md bg-tile object-cover" />
                      <span className="line-clamp-1 max-w-[240px]">{p.name}</span>
                    </Link>
                  </td>
                  <td className="tabular-nums">{num(p.units)}</td>
                  <td className="font-semibold tabular-nums">{inr(p.revenue, { compact: true })}</td>
                  <td className="tabular-nums">{p.margin === null ? '—' : `${p.margin}%`}</td>
                  <td className="whitespace-nowrap tabular-nums text-muted">
                    {num(p.views)} → {num(p.orders)} <span className="text-ink">({p.conversion ?? 0}%)</span>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Loading />
          )}
        </Panel>
        <Panel title="Revenue by category">{cats.data ? <HBarList items={cats.data.map((c) => ({ label: c.category, value: c.revenue, sub: `${c.share}%` }))} /> : <Loading />}</Panel>
      </div>

      <Panel title="Latest orders" className="mt-5" padded={false} actions={<Link href="/admin/orders" className="text-sm font-semibold underline underline-offset-4">All orders</Link>}>
        {rt.data ? (
          <Table head={['Order', 'Customer', 'City', 'Payment', 'Status', 'Total', '']}>
            {rt.data.latest.map((o: any) => (
              <tr key={o.id} className="hover:bg-tile/50">
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td>{o.customer}</td>
                <td className="text-muted">{o.city}</td>
                <td className="text-muted">{o.paymentMethod === 'COD' ? 'COD' : 'Online'}</td>
                <td>
                  <StatusBadge status={o.status as OrderStatus} />
                </td>
                <td className="font-semibold tabular-nums">{inr(o.total)}</td>
                <td className="text-xs text-muted">{timeAgo(o.createdAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Loading />
        )}
      </Panel>
      {ov.data && ov.data.current.orders === 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <AlertTriangle size={15} /> No orders in this range yet.
        </p>
      )}
    </div>
  );
}
