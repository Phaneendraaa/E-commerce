'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { inr, timeAgo } from '@/lib/format';
import { Loading, PageHeader, Panel, Table, useApi } from '@/components/admin/kit';
import { Spinner } from '@/components/ui';

export default function AbandonedCartsPage() {
  const { data, reload } = useApi<any>('/admin/analytics/abandoned-carts');
  const [running, setRunning] = useState(false);

  const runNow = async () => {
    setRunning(true);
    try {
      await api('/admin/jobs/abandoned-carts/run', { method: 'POST' });
      toast.success('Reminder run complete');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Abandoned carts"
        description="Carts idle for over an hour. Reminders go out automatically on email and WhatsApp (twice, the second with a coupon)."
        actions={
          <button onClick={runNow} disabled={running} className="btn btn-primary btn-sm">
            {running ? <Spinner size={14} /> : null} Send due reminders now
          </button>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Abandoned carts', data.abandoned],
              ['Value at stake', inr(data.value, { compact: true })],
              ['Reminded', data.reminded],
              ['Recovered (30 days)', data.recovered30d],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line">
                <div className="text-xs text-muted">{k}</div>
                <div className="mt-1 font-display text-2xl font-bold">{v}</div>
              </div>
            ))}
          </div>
          <Panel padded={false}>
            <Table head={['Customer', 'Contact', 'Items', 'Value', 'Last activity', 'Reminders sent']}>
              {data.carts.map((c: any) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  <td className="text-muted">{c.phone ?? c.email}</td>
                  <td className="tabular-nums">{c.items}</td>
                  <td className="font-semibold tabular-nums">{inr(c.value)}</td>
                  <td className="text-muted">{timeAgo(c.lastActivityAt)}</td>
                  <td className="tabular-nums">{c.reminderCount}</td>
                </tr>
              ))}
            </Table>
            {!data.carts.length && <p className="p-8 text-center text-sm text-muted">No abandoned carts right now.</p>}
          </Panel>
          <p className="mt-3 text-xs text-muted">
            Timing is set by <code>ABANDONED_CART_HOURS</code> on the server. Track recoveries in <Link href="/admin/analytics?tab=payments" className="underline">Analytics</Link>.
          </p>
        </>
      )}
    </div>
  );
}
