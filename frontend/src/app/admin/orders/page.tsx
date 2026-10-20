'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { api, errorMessage, qs } from '@/lib/api';
import { dateTime, inr } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';
import { Loading, PageHeader, Pager, Panel, SearchInput, Table, useApi } from '@/components/admin/kit';
import { StatusBadge } from '@/components/store/OrderBits';

const QUICK: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'To ship', value: 'CONFIRMED,PROCESSING,PACKED' },
  { label: 'In transit', value: 'SHIPPED,OUT_FOR_DELIVERY' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Awaiting payment', value: 'PENDING_PAYMENT' },
  { label: 'Returns', value: 'RETURN_REQUESTED,RETURNED,REFUNDED' },
  { label: 'Cancelled', value: 'CANCELLED,FAILED' },
];

interface Row {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: 'RAZORPAY' | 'COD';
  total: number;
  createdAt: string;
  city: string;
  itemCount: number;
  carrier: string | null;
  trackingNumber: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null };
}

function OrdersInner() {
  const params = useSearchParams();
  const router = useRouter();
  const get = (k: string, d = '') => params.get(k) ?? d;
  const setParam = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!('page' in patch)) p.delete('page');
    router.replace(`/admin/orders?${p}`);
  };
  const query = { status: get('status'), q: get('q'), paymentMethod: get('method'), from: get('from'), to: get('to'), sort: get('sort', 'newest'), page: get('page', '1'), limit: 25 };
  const { data, loading, reload } = useApi<{ items: Row[]; statusCounts: Record<string, number>; page: number; totalPages: number; total: number }>('/admin/orders', query);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState('');

  const count = (v: string) => (v ? v.split(',').reduce((s, k) => s + (data?.statusCounts[k] ?? 0), 0) : Object.values(data?.statusCounts ?? {}).reduce((a, b) => a + b, 0));

  const runBulk = async () => {
    if (!bulk || !selected.size) return;
    try {
      const r = await api<{ updated: number; results: { ok: boolean; error?: string }[] }>('/admin/orders/bulk-status', { body: { ids: [...selected], status: bulk } });
      const failed = r.results.filter((x) => !x.ok);
      toast.success(`${r.updated} order${r.updated === 1 ? '' : 's'} updated${failed.length ? ` · ${failed.length} skipped (${failed[0].error})` : ''}`);
      setSelected(new Set());
      setBulk('');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const exportHref = `/api/admin/orders/export${qs({ status: query.status, q: query.q, paymentMethod: query.paymentMethod, from: query.from, to: query.to })}`;

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Fulfil, track and message customers about their orders"
        actions={
          <a href={exportHref} className="btn btn-outline btn-sm">
            <Download size={15} /> Export CSV
          </a>
        }
      />
      <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {QUICK.map((q) => (
          <button key={q.label} data-active={get('status') === q.value} onClick={() => setParam({ status: q.value })} className="chip shrink-0">
            {q.label}
            {data && <span className="text-xs opacity-60">{count(q.value)}</span>}
          </button>
        ))}
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <SearchInput value={get('q')} onChange={(v) => setParam({ q: v })} placeholder="Order #, name, phone, email, AWB" />
          <select value={get('method')} onChange={(e) => setParam({ method: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="Payment method">
            <option value="">All payments</option>
            <option value="RAZORPAY">Online</option>
            <option value="COD">Cash on Delivery</option>
          </select>
          <input type="date" value={get('from')} onChange={(e) => setParam({ from: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="From date" />
          <input type="date" value={get('to')} onChange={(e) => setParam({ to: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="To date" />
          <select value={get('sort', 'newest')} onChange={(e) => setParam({ sort: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total_desc">Highest value</option>
            <option value="total_asc">Lowest value</option>
          </select>
          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2 rounded-full bg-marigold-soft py-1 pl-3 pr-1 text-sm">
              <b>{selected.size} selected</b>
              <select value={bulk} onChange={(e) => setBulk(e.target.value)} className="h-8 rounded-full border border-line bg-surface px-2 text-sm" aria-label="Bulk action">
                <option value="">Mark as…</option>
                <option value="PROCESSING">Processing</option>
                <option value="PACKED">Packed</option>
                <option value="OUT_FOR_DELIVERY">Out for delivery</option>
                <option value="DELIVERED">Delivered</option>
              </select>
              <button disabled={!bulk} onClick={runBulk} className="btn btn-primary btn-sm">
                Apply
              </button>
            </div>
          )}
        </div>
        {loading && !data ? (
          <Loading />
        ) : (
          <Table
            head={[
              <input
                key="all"
                type="checkbox"
                aria-label="Select all"
                className="size-4 accent-[var(--ink)]"
                checked={!!data?.items.length && data.items.every((o) => selected.has(o.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(data?.items.map((o) => o.id)) : new Set())}
              />,
              'Order',
              'Date',
              'Customer',
              'Items',
              'Payment',
              'Status',
              'Shipment',
              'Total',
            ]}
          >
            {data?.items.map((o) => (
              <tr key={o.id} className={`hover:bg-tile/50 ${selected.has(o.id) ? 'bg-marigold-soft/50' : ''}`}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${o.orderNumber}`}
                    className="size-4 accent-[var(--ink)]"
                    checked={selected.has(o.id)}
                    onChange={() => {
                      const n = new Set(selected);
                      if (n.has(o.id)) n.delete(o.id);
                      else n.add(o.id);
                      setSelected(n);
                    }}
                  />
                </td>
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="whitespace-nowrap text-muted">{dateTime(o.createdAt)}</td>
                <td>
                  <div className="font-medium">{o.customer.name}</div>
                  <div className="text-xs text-muted">{o.city}</div>
                </td>
                <td className="tabular-nums">{o.itemCount}</td>
                <td>
                  <div>{o.paymentMethod === 'COD' ? 'COD' : 'Online'}</div>
                  <div className={`text-xs ${o.paymentStatus === 'PAID' ? 'text-peacock' : 'text-muted'}`}>{o.paymentStatus.toLowerCase()}</div>
                </td>
                <td>
                  <StatusBadge status={o.status} />
                </td>
                <td className="text-xs text-muted">{o.trackingNumber ? `${o.carrier} · ${o.trackingNumber}` : '—'}</td>
                <td className="font-semibold tabular-nums">{inr(o.total)}</td>
              </tr>
            ))}
          </Table>
        )}
        {data && !data.items.length && <p className="p-10 text-center text-sm text-muted">No orders match these filters.</p>}
        {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={(p) => setParam({ page: String(p) })} />}
      </Panel>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense>
      <OrdersInner />
    </Suspense>
  );
}
