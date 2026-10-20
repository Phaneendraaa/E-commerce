'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { inr, num } from '@/lib/format';
import { Loading, PageHeader, Panel, RangePicker, Table, useApi } from '@/components/admin/kit';
import { Bars, HBarList, Heatmap, ShareBar, TwoLines } from '@/components/admin/charts';
import { Img } from '@/components/ui';

const TABS = [
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products' },
  { id: 'traffic', label: 'Traffic & search' },
  { id: 'geography', label: 'Geography' },
  { id: 'timing', label: 'When people buy' },
  { id: 'payments', label: 'Payments & fulfilment' },
  { id: 'marketing', label: 'Coupons & messaging' },
];

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 font-display text-[26px] font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

const SEGMENT_HELP: Record<string, string> = {
  Champions: 'Bought recently, buy often and spend the most',
  Loyal: 'Regular buyers who respond well to rewards',
  'New & Promising': 'Recent first-time buyers — nurture them',
  'Potential Loyalists': 'Recent buyers with growing frequency',
  'At Risk': 'Used to buy often but haven’t lately',
  "Can't Lose Them": 'Big spenders drifting away — win them back',
  Hibernating: 'Low recency, frequency and spend',
};

function Customers({ days }: { days: number }) {
  const c = useApi<any>('/admin/analytics/customers', { days });
  const co = useApi<{ cohort: string; size: number; retention: (number | null)[] }[]>('/admin/analytics/cohorts');
  if (!c.data) return <Loading />;
  const d = c.data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Customer lifetime value" value={inr(d.lifetime.clv, { compact: true })} sub="Average total spend per buyer" />
        <Stat label="Orders per customer" value={d.lifetime.ordersPerCustomer} />
        <Stat label="Repeat purchase rate" value={`${d.lifetime.repeatRate}%`} sub="Buyers with 2+ orders" />
        <Stat label="Customers who bought" value={num(d.lifetime.customers)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="New vs returning buyers" description="Distinct buyers per week">
          <TwoLines data={d.newVsReturning} a="new" b="returning" labels={['New', 'Returning']} />
        </Panel>
        <Panel title="RFM segments" description="Recency · frequency · monetary scoring of every buyer">
          <ul className="divide-y divide-line">
            {d.segments.map((s: any) => (
              <li key={s.segment} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="flex-1">
                  <div className="font-semibold">{s.segment}</div>
                  <div className="text-xs text-muted">{SEGMENT_HELP[s.segment]}</div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="font-semibold">{num(s.customers)} customers</div>
                  <div className="text-xs text-muted">
                    {inr(s.revenue, { compact: true })} · last order ~{s.avg_recency}d ago
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Panel title="Cohort retention" description="Share of each month’s new buyers who ordered again in later months" padded={false}>
        {co.data ? (
          <Table head={['First order', 'Buyers', ...Array.from({ length: 6 }, (_, i) => (i === 0 ? 'Month 0' : `+${i}`))]}>
            {co.data.map((r) => (
              <tr key={r.cohort}>
                <td className="font-semibold">{new Date(r.cohort + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                <td className="tabular-nums">{r.size}</td>
                {r.retention.map((v, i) => (
                  <td key={i} className="!px-1 text-center">
                    {v === null ? (
                      <span className="text-faint">·</span>
                    ) : (
                      <span
                        className="block rounded-[4px] py-1.5 text-xs font-semibold tabular-nums"
                        style={{ background: `var(--seq-${Math.max(1, Math.ceil((v / 100) * 5))})`, color: v > 60 ? '#fff' : 'var(--ink)' }}
                      >
                        {v}%
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
        ) : (
          <Loading />
        )}
      </Panel>
      <Panel title="Top customers" padded={false}>
        <Table head={['Customer', 'Contact', 'Orders', 'Spent', 'Last order']}>
          {d.topCustomers.map((t: any) => (
            <tr key={t.id}>
              <td>
                <Link href={`/admin/customers/${t.id}`} className="font-semibold hover:underline">
                  {t.name}
                </Link>
              </td>
              <td className="text-muted">{t.email ?? t.phone}</td>
              <td className="tabular-nums">{t.orders}</td>
              <td className="font-semibold tabular-nums">{inr(t.spent)}</td>
              <td className="text-muted">{new Date(t.lastOrderAt).toLocaleDateString('en-IN')}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

function Products({ days }: { days: number }) {
  const [sort, setSort] = useState('revenue');
  const p = useApi<any[]>('/admin/analytics/products', { days, limit: 40, sort });
  const inv = useApi<any>('/admin/analytics/inventory');
  return (
    <div className="space-y-5">
      <Panel
        title="Product performance"
        padded={false}
        actions={
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 rounded-full border border-line bg-surface px-3 text-xs font-semibold" aria-label="Sort by">
            <option value="revenue">Sort: revenue</option>
            <option value="units">Sort: units sold</option>
            <option value="profit">Sort: profit</option>
            <option value="margin">Sort: margin</option>
            <option value="views">Sort: views</option>
            <option value="conversion">Sort: conversion</option>
          </select>
        }
      >
        {p.data ? (
          <Table head={['Product', 'Category', 'Units', 'Revenue', 'Profit', 'Margin', 'Views', 'Add-to-cart', 'Conversion', 'Stock']}>
            {p.data.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/products/${r.id}`} className="flex items-center gap-2.5 hover:underline">
                    <Img src={r.image} alt="" className="size-8 rounded bg-tile object-cover" />
                    <span className="line-clamp-1 max-w-[220px]">{r.name}</span>
                  </Link>
                </td>
                <td className="text-muted">{r.category}</td>
                <td className="tabular-nums">{num(r.units)}</td>
                <td className="font-semibold tabular-nums">{inr(r.revenue, { compact: true })}</td>
                <td className="tabular-nums">{inr(r.profit, { compact: true })}</td>
                <td className="tabular-nums">{r.margin ?? '—'}%</td>
                <td className="tabular-nums">{num(r.views)}</td>
                <td className="tabular-nums">{r.addToCartRate ?? 0}%</td>
                <td className="tabular-nums">{r.conversion ?? 0}%</td>
                <td className={`tabular-nums ${r.stock < 10 ? 'font-semibold text-danger' : ''}`}>{r.stock}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Loading />
        )}
      </Panel>
      {inv.data && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Inventory value">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted">At cost</div>
                <div className="font-display text-2xl font-bold">{inr(inv.data.summary.stockValueCost, { compact: true })}</div>
              </div>
              <div>
                <div className="text-muted">At retail</div>
                <div className="font-display text-2xl font-bold">{inr(inv.data.summary.stockValueRetail, { compact: true })}</div>
              </div>
              <div>
                <div className="text-muted">Units on hand</div>
                <div className="font-semibold">{num(inv.data.summary.units)}</div>
              </div>
              <div>
                <div className="text-muted">Out of stock / low</div>
                <div className="font-semibold">
                  {inv.data.summary.outOfStock} / {inv.data.summary.lowStock} variants
                </div>
              </div>
            </div>
          </Panel>
          <Panel title="Slow movers" description="In stock but no sales in 45 days — consider a deal">
            {inv.data.deadStock.length ? (
              <HBarList items={inv.data.deadStock.map((d: any) => ({ label: d.name, value: d.value, sub: `${d.stock} units` }))} />
            ) : (
              <p className="text-sm text-muted">Everything is selling. Nice.</p>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Traffic({ days }: { days: number }) {
  const t = useApi<any>('/admin/analytics/traffic', { days });
  if (!t.data) return <Loading />;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Panel title="Traffic sources" description="Sessions by UTM source, with conversion and revenue" padded={false}>
        <Table head={['Source', 'Sessions', 'Orders', 'Conversion', 'Revenue']}>
          {t.data.sources.map((s: any) => (
            <tr key={s.source}>
              <td className="font-semibold capitalize">{s.source}</td>
              <td className="tabular-nums">{num(s.sessions)}</td>
              <td className="tabular-nums">{num(s.orders)}</td>
              <td className="tabular-nums">{s.conversion}%</td>
              <td className="font-semibold tabular-nums">{inr(s.revenue, { compact: true })}</td>
            </tr>
          ))}
        </Table>
      </Panel>
      <div className="space-y-5">
        <Panel title="Devices">
          <ShareBar items={t.data.devices.filter((d: any) => d.device !== 'unknown').map((d: any) => ({ label: d.device, value: d.sessions }))} />
        </Panel>
        <Panel title="Top searches" description="What shoppers type into search">
          <HBarList format="num" items={t.data.searches.map((s: any) => ({ label: s.term, value: s.searches }))} />
        </Panel>
      </div>
    </div>
  );
}

function Geography({ days }: { days: number }) {
  const g = useApi<any>('/admin/analytics/geography', { days });
  if (!g.data) return <Loading />;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Revenue by state">
        <HBarList items={g.data.states.slice(0, 12).map((s: any) => ({ label: s.state, value: s.revenue, sub: `${s.orders} orders` }))} />
      </Panel>
      <Panel title="Top cities" padded={false}>
        <Table head={['City', 'State', 'Orders', 'Revenue']}>
          {g.data.cities.map((c: any) => (
            <tr key={c.city + c.state}>
              <td className="font-semibold">{c.city}</td>
              <td className="text-muted">{c.state}</td>
              <td className="tabular-nums">{c.orders}</td>
              <td className="font-semibold tabular-nums">{inr(c.revenue, { compact: true })}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

function Timing({ days }: { days: number }) {
  const h = useApi<{ grid: number[][]; peak: { dow: number; hour: number; orders: number } | null }>('/admin/analytics/heatmap', { days: Math.max(days, 30) });
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (!h.data) return <Loading />;
  const byDay = h.data.grid.map((row, i) => ({ day: DAYS[i].slice(0, 3), orders: row.reduce((a, b) => a + b, 0) }));
  return (
    <div className="space-y-5">
      <Panel
        title="Orders by weekday and hour"
        description={h.data.peak ? `Busiest slot: ${DAYS[h.data.peak.dow]} around ${h.data.peak.hour}:00 (IST). Schedule campaigns and WhatsApp blasts just before it.` : undefined}
      >
        <Heatmap grid={h.data.grid} />
      </Panel>
      <Panel title="Orders by weekday">
        <Bars data={byDay} x="day" y="orders" height={220} />
      </Panel>
    </div>
  );
}

function Payments({ days }: { days: number }) {
  const p = useApi<any>('/admin/analytics/payments', { days });
  const carts = useApi<any>('/admin/analytics/abandoned-carts');
  if (!p.data) return <Loading />;
  const d = p.data;
  const cod = d.methods.find((m: any) => m.method === 'COD');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Payment success rate" value={`${d.gateway.successRate}%`} sub={`${d.gateway.paid} of ${d.gateway.attempts} Razorpay attempts`} />
        <Stat label="Time to ship" value={`${d.fulfilment.hoursToShip}h`} sub="Order to dispatch, average" />
        <Stat label="Days in transit" value={d.fulfilment.daysInTransit} sub="Dispatch to delivery, average" />
        <Stat label="On-time delivery" value={d.fulfilment.onTimeRate === null ? '—' : `${d.fulfilment.onTimeRate}%`} sub="Delivered by the promised date" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Payment methods">
          <ShareBar items={d.methods.map((m: any) => ({ label: m.method === 'COD' ? 'Cash on Delivery' : 'Online', value: m.orders }))} />
          {cod && <p className="mt-4 text-xs text-muted">COD orders: {cod.cancelled} cancelled, {cod.returned} returned in this period.</p>}
        </Panel>
        <Panel title="Online payment instruments">
          <ShareBar items={Object.entries(d.gateway.instruments as Record<string, number>).map(([k, v]) => ({ label: k, value: v }))} />
        </Panel>
        <Panel title="Why orders get cancelled">
          <HBarList format="num" color="var(--chart-2)" items={d.cancelReasons.map((c: any) => ({ label: c.reason, value: c.orders }))} />
        </Panel>
      </div>
      {carts.data && (
        <Panel title="Abandoned carts" description="Carts idle for over an hour" actions={<Link href="/admin/carts" className="text-sm font-semibold underline underline-offset-4">View carts</Link>}>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <div className="text-muted">Abandoned now</div>
              <div className="font-display text-2xl font-bold">{carts.data.abandoned}</div>
            </div>
            <div>
              <div className="text-muted">Value at stake</div>
              <div className="font-display text-2xl font-bold">{inr(carts.data.value, { compact: true })}</div>
            </div>
            <div>
              <div className="text-muted">Reminded</div>
              <div className="font-display text-2xl font-bold">{carts.data.reminded}</div>
            </div>
            <div>
              <div className="text-muted">Recovered (30d)</div>
              <div className="font-display text-2xl font-bold">{carts.data.recovered30d}</div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

function Marketing({ days }: { days: number }) {
  const c = useApi<any[]>('/admin/analytics/coupons', { days });
  const n = useApi<any>('/admin/analytics/notifications', { days });
  return (
    <div className="space-y-5">
      <Panel title="Coupon performance" description="Revenue driven per rupee of discount (ROI)" padded={false}>
        {c.data ? (
          <Table head={['Code', 'Type', 'Uses', 'Discount given', 'Order revenue', 'ROI', 'Status']}>
            {c.data.map((r) => (
              <tr key={r.code}>
                <td className="font-semibold">{r.code}</td>
                <td className="text-muted">{r.type === 'PERCENT' ? `${r.value}%` : r.type === 'FLAT' ? inr(r.value) : 'Free ship'}</td>
                <td className="tabular-nums">{r.uses}</td>
                <td className="tabular-nums">{inr(r.discount, { compact: true })}</td>
                <td className="font-semibold tabular-nums">{inr(r.revenue, { compact: true })}</td>
                <td className="tabular-nums">{r.roi ? `${r.roi}×` : '—'}</td>
                <td>{r.isActive ? <span className="text-peacock">Active</span> : <span className="text-muted">Inactive</span>}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Loading />
        )}
      </Panel>
      {n.data && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Messages by channel" padded={false}>
            <Table head={['Channel', 'Total', 'Sent', 'Failed', 'Not configured']}>
              {n.data.byChannel.map((r: any) => (
                <tr key={r.channel}>
                  <td className="font-semibold">{r.channel === 'WHATSAPP' ? 'WhatsApp' : r.channel === 'SMS' ? 'SMS' : 'Email'}</td>
                  <td className="tabular-nums">{r.total}</td>
                  <td className="tabular-nums text-peacock">{r.sent}</td>
                  <td className="tabular-nums text-danger">{r.failed}</td>
                  <td className="tabular-nums text-muted">{r.skipped}</td>
                </tr>
              ))}
            </Table>
          </Panel>
          <Panel title="WhatsApp engagement">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Delivery rate" value={n.data.whatsapp.deliveryRate === null ? '—' : `${n.data.whatsapp.deliveryRate}%`} />
              <Stat label="Read rate" value={n.data.whatsapp.readRate === null ? '—' : `${n.data.whatsapp.readRate}%`} />
            </div>
            <p className="mt-3 text-xs text-muted">Receipts come from the WhatsApp Cloud API webhook.</p>
          </Panel>
        </div>
      )}
    </div>
  );
}

function AnalyticsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') ?? 'customers';
  const [days, setDays] = useState(30);
  const Body = { customers: Customers, products: Products, traffic: Traffic, geography: Geography, timing: Timing, payments: Payments, marketing: Marketing }[tab] ?? Customers;
  return (
    <div>
      <PageHeader title="Analytics" description="Deep dives into customers, products, traffic and operations" actions={<RangePicker days={days} onChange={setDays} />} />
      <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} data-active={tab === t.id} onClick={() => router.replace(`/admin/analytics?tab=${t.id}`)} className="chip shrink-0">
            {t.label}
          </button>
        ))}
      </div>
      <Body days={days} />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsInner />
    </Suspense>
  );
}
