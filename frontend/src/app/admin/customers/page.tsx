'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { qs } from '@/lib/api';
import { date, inr } from '@/lib/format';
import { Loading, PageHeader, Pager, Panel, SearchInput, Table, useApi } from '@/components/admin/kit';
import { Badge } from '@/components/ui';

const SEGMENTS = [
  { label: 'Everyone', value: '' },
  { label: 'Buyers', value: 'buyers' },
  { label: 'Repeat buyers', value: 'repeat' },
  { label: 'No orders yet', value: 'no_orders' },
  { label: 'Inactive 60+ days', value: 'inactive_60' },
  { label: 'Blocked', value: 'blocked' },
];

function CustomersInner() {
  const params = useSearchParams();
  const router = useRouter();
  const get = (k: string, d = '') => params.get(k) ?? d;
  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!('page' in patch)) p.delete('page');
    router.replace(`/admin/customers?${p}`);
  };
  const query = { q: get('q'), segment: get('segment'), role: get('role'), sort: get('sort', 'newest'), page: get('page', '1'), limit: 25 };
  const { data } = useApi<any>('/admin/customers', query);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Everyone who has an account, with lifetime value"
        actions={
          <a href={`/api/admin/customers/export${qs({ q: query.q, segment: query.segment })}`} className="btn btn-outline btn-sm">
            <Download size={15} /> Export CSV
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <button key={s.label} data-active={get('segment') === s.value && !get('role')} onClick={() => set({ segment: s.value, role: '' })} className="chip">
            {s.label}
          </button>
        ))}
        <button data-active={get('role') === 'STAFF'} onClick={() => set({ role: 'STAFF', segment: '' })} className="chip">
          Staff
        </button>
      </div>
      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <SearchInput value={get('q')} onChange={(v) => set({ q: v })} placeholder="Name, email or phone" />
          <select value={get('sort', 'newest')} onChange={(e) => set({ sort: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="spent">Highest spend</option>
            <option value="orders">Most orders</option>
            <option value="last_order">Recent order</option>
            <option value="name">Name</option>
          </select>
        </div>
        {!data ? (
          <Loading />
        ) : (
          <Table head={['Customer', 'Contact', 'Orders', 'Lifetime spend', 'Points', 'Last order', 'Joined']}>
            {data.items.map((c: any) => (
              <tr key={c.id} className="hover:bg-tile/50">
                <td>
                  <Link href={`/admin/customers/${c.id}`} className="font-semibold hover:underline">
                    {c.name}
                  </Link>
                  {c.role !== 'CUSTOMER' && <Badge tone="info" className="ml-2">{c.role.toLowerCase()}</Badge>}
                  {c.isBlocked && <Badge tone="danger" className="ml-2">blocked</Badge>}
                </td>
                <td className="text-muted">
                  <div>{c.email}</div>
                  <div className="text-xs">{c.phone}</div>
                </td>
                <td className="tabular-nums">{c.orders}</td>
                <td className="font-semibold tabular-nums">{inr(c.spent)}</td>
                <td className="tabular-nums">{c.loyaltyPoints}</td>
                <td className="text-muted">{c.lastOrderAt ? date(c.lastOrderAt) : '—'}</td>
                <td className="text-muted">{date(c.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={(p) => set({ page: String(p) })} />}
      </Panel>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersInner />
    </Suspense>
  );
}
