'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { inr, num } from '@/lib/format';
import { Loading, PageHeader, Panel, Table, useApi } from '@/components/admin/kit';
import { Badge } from '@/components/ui';

/** Restock screen: variants that are low, out of stock or running out soon (by sales velocity). */
export default function InventoryPage() {
  const { data, reload } = useApi<any>('/admin/analytics/inventory');
  const [adjust, setAdjust] = useState<Record<string, string>>({});

  const apply = async (id: string) => {
    const n = Number(adjust[id]);
    if (!n) return;
    try {
      await api(`/admin/variants/${id}`, { method: 'PATCH', body: { adjust: n } });
      toast.success(`Stock ${n > 0 ? 'increased' : 'reduced'} by ${Math.abs(n)}`);
      setAdjust({ ...adjust, [id]: '' });
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader title="Inventory" description="Restock before you run out. “Days left” uses the last 30 days of sales. Back-in-stock alerts go out automatically when you restock." />
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Units on hand', num(data.summary.units)],
              ['Stock value (cost)', inr(data.summary.stockValueCost, { compact: true })],
              ['Out of stock variants', data.summary.outOfStock],
              ['Low stock variants', data.summary.lowStock],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line">
                <div className="text-xs text-muted">{k}</div>
                <div className="mt-1 font-display text-2xl font-bold">{v}</div>
              </div>
            ))}
          </div>
          <Panel title="Needs restocking" padded={false}>
            <Table head={['Product', 'SKU', 'In stock', 'Sells per day', 'Days left', 'Waiting', 'Adjust stock']}>
              {data.lowStock.map((v: any) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/product/${v.slug}`} target="_blank" className="font-medium hover:underline">
                      {v.name}
                    </Link>
                    {v.title !== 'Default' && <div className="text-xs text-muted">{v.title}</div>}
                  </td>
                  <td className="text-xs text-muted">{v.sku}</td>
                  <td>
                    <Badge tone={v.stock === 0 ? 'danger' : v.stock <= v.threshold ? 'warn' : 'neutral'}>{v.stock === 0 ? 'Out of stock' : v.stock}</Badge>
                  </td>
                  <td className="tabular-nums">{v.dailySales}</td>
                  <td className="tabular-nums">{v.daysLeft === null ? '—' : v.daysLeft === 0 ? <span className="font-semibold text-danger">0</span> : v.daysLeft}</td>
                  <td className="tabular-nums">{v.waitlist ? <span className="font-semibold text-peacock">{v.waitlist} customers</span> : '—'}</td>
                  <td>
                    <form
                      className="flex gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void apply(v.id);
                      }}
                    >
                      <input value={adjust[v.id] ?? ''} onChange={(e) => setAdjust({ ...adjust, [v.id]: e.target.value.replace(/[^\d-]/g, '') })} placeholder="+25" className="field !h-8 !w-20 text-sm" aria-label={`Adjust stock for ${v.sku}`} />
                      <button className="btn btn-outline btn-sm !h-8">Update</button>
                    </form>
                  </td>
                </tr>
              ))}
            </Table>
            {!data.lowStock.length && <p className="p-8 text-center text-sm text-muted">Everything is well stocked.</p>}
          </Panel>
        </>
      )}
    </div>
  );
}
