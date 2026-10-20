'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { date, inr } from '@/lib/format';
import { Loading, PageHeader, Panel, useApi } from '@/components/admin/kit';
import { Badge, Img, Spinner } from '@/components/ui';

const TABS = [
  { label: 'Needs action', value: 'REQUESTED,APPROVED,PICKED_UP' },
  { label: 'Refunded', value: 'REFUNDED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'All', value: '' },
];
const NEXT: Record<string, { status: string; label: string; tone?: string }[]> = {
  REQUESTED: [
    { status: 'APPROVED', label: 'Approve & schedule pickup' },
    { status: 'REJECTED', label: 'Reject', tone: 'danger' },
  ],
  APPROVED: [{ status: 'PICKED_UP', label: 'Mark picked up' }],
  PICKED_UP: [{ status: 'REFUNDED', label: 'Issue refund' }],
};
const TONE: Record<string, 'warn' | 'info' | 'success' | 'danger'> = { REQUESTED: 'warn', APPROVED: 'info', PICKED_UP: 'info', REFUNDED: 'success', REJECTED: 'danger' };

export default function ReturnsPage() {
  const [tab, setTab] = useState(TABS[0].value);
  const { data, reload } = useApi<{ returns: any[] }>('/admin/orders/returns/list', { status: tab });
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (r: any, status: string) => {
    let adminNote: string | undefined;
    if (status === 'REJECTED') {
      adminNote = prompt('Reason for rejecting (shared with the customer)') ?? undefined;
      if (!adminNote) return;
    }
    if (status === 'REFUNDED' && !confirm(`Refund ${inr(r.refundAmount ?? r.order.total)} to ${r.user.name}?`)) return;
    setBusy(r.id + status);
    try {
      await api(`/admin/orders/returns/${r.id}`, { body: { status, adminNote } });
      toast.success('Return updated — customer notified');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Returns" description="Approve pickups, then refund once items are back" />
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.label} data-active={tab === t.value} onClick={() => setTab(t.value)} className="chip">
            {t.label}
          </button>
        ))}
      </div>
      {!data ? (
        <Loading />
      ) : !data.returns.length ? (
        <Panel>
          <p className="py-8 text-center text-sm text-muted">No return requests here.</p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {data.returns.map((r) => {
            const items = r.order.items.filter((i: any) => r.itemIds.includes(i.id));
            return (
              <Panel key={r.id}>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/orders/${r.order.id}`} className="font-semibold hover:underline">
                        {r.order.orderNumber}
                      </Link>
                      <Badge tone={TONE[r.status]}>{r.status.toLowerCase().replace('_', ' ')}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      {r.user.name} · {r.user.phone ?? r.user.email} · requested {date(r.createdAt)}
                    </div>
                    <div className="mt-2 text-sm">
                      <b>{r.reason}</b>
                      {r.details && <span className="text-muted"> — {r.details}</span>}
                    </div>
                    {r.adminNote && <div className="mt-1 text-xs text-muted">Note: {r.adminNote}</div>}
                  </div>
                  <div className="flex -space-x-2">
                    {items.map((i: any) => (
                      <Img key={i.id} src={i.image} alt={i.name} className="size-12 rounded-md bg-tile object-cover ring-2 ring-surface" />
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Refund</div>
                    <div className="font-display text-xl font-bold">{inr(r.refundAmount ?? 0)}</div>
                    <div className="text-xs text-muted">{r.order.paymentMethod === 'COD' ? 'COD — refund to bank' : 'To original payment'}</div>
                  </div>
                </div>
                {NEXT[r.status] && (
                  <div className="mt-4 flex gap-2 border-t border-line pt-4">
                    {NEXT[r.status].map((n) => (
                      <button key={n.status} disabled={busy !== null} onClick={() => act(r, n.status)} className={`btn btn-sm ${n.tone === 'danger' ? 'btn-ghost text-danger' : 'btn-primary'}`}>
                        {busy === r.id + n.status ? <Spinner size={14} /> : n.label}
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
