'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { api } from '@/lib/api';
import { date, inr } from '@/lib/format';
import type { Order, Paged } from '@/lib/types';
import { Empty, Img } from '@/components/ui';
import { StatusBadge } from '@/components/store/OrderBits';

const TABS = [
  { label: 'All', value: '' },
  { label: 'In progress', value: 'PENDING_PAYMENT,CONFIRMED,PROCESSING,PACKED,SHIPPED,OUT_FOR_DELIVERY' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled & returns', value: 'CANCELLED,FAILED,RETURN_REQUESTED,RETURNED,REFUNDED' },
];

export default function OrdersPage() {
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Order> | null>(null);

  useEffect(() => {
    setData(null);
    api<Paged<Order>>('/orders', { query: { status: tab, page, limit: 10 } })
      .then(setData)
      .catch(() => undefined);
  }, [tab, page]);

  return (
    <div>
      <h1 className="text-[32px] md:text-[40px]">Orders</h1>
      <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.label} onClick={() => (setTab(t.value), setPage(1))} data-active={tab === t.value} className="chip shrink-0">
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {!data && [0, 1, 2].map((i) => <div key={i} className="skeleton h-36" />)}
        {data?.items.map((o) => (
          <article key={o.id} className="overflow-hidden rounded-[var(--radius)] bg-surface ring-1 ring-line">
            <header className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-tile/60 px-5 py-3 text-sm">
              <div>
                <span className="text-muted">Order </span>
                <b>{o.orderNumber}</b>
              </div>
              <div className="text-muted">Placed {date(o.createdAt)}</div>
              <div className="text-muted">
                Total <b className="text-ink">{inr(o.total)}</b>
              </div>
              <div className="ml-auto">
                <StatusBadge status={o.status} />
              </div>
            </header>
            <div className="flex flex-wrap items-center gap-4 p-5">
              <div className="flex flex-1 flex-wrap gap-3">
                {o.items.slice(0, 4).map((i, k) => (
                  <div key={k} className="flex items-center gap-3">
                    <Img src={i.image} alt="" className="size-16 rounded-[var(--radius-sm)] bg-tile object-cover" />
                    {o.items.length === 1 && (
                      <div className="text-sm">
                        <div className="font-medium">{i.name}</div>
                        <div className="text-muted">Qty {i.quantity}</div>
                      </div>
                    )}
                  </div>
                ))}
                {o.items.length > 4 && <div className="grid size-16 place-items-center rounded-[var(--radius-sm)] bg-tile text-sm font-semibold">+{o.items.length - 4}</div>}
              </div>
              <Link href={`/account/orders/${o.orderNumber}`} className="btn btn-outline btn-sm">
                {o.status === 'PENDING_PAYMENT' ? 'Complete payment' : ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.status) ? 'Track order' : 'View details'}
              </Link>
            </div>
          </article>
        ))}
        {data && !data.items.length && (
          <Empty
            icon={<Package size={26} />}
            title="No orders here"
            body="When you place an order it will show up here with live tracking."
            action={
              <Link href="/shop" className="btn btn-primary">
                Start shopping
              </Link>
            }
          />
        )}
      </div>
      {data && data.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="chip disabled:opacity-40">
            Previous
          </button>
          <span className="chip pointer-events-none">
            {page} / {data.totalPages}
          </span>
          <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="chip disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
