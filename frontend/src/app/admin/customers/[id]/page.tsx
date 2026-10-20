'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Mail, MessageCircle, Phone } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { date, dateTime, inr, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { ErrorNote, Loading, Panel, Table, Toggle, useApi } from '@/components/admin/kit';
import { StatusBadge } from '@/components/store/OrderBits';
import { Badge, Spinner } from '@/components/ui';

export default function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAuth((s) => s.user);
  const { data, error, reload } = useApi<any>(`/admin/customers/${id}`);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const c = data.customer;
  const s = data.stats;

  const patch = async (body: Record<string, unknown>) => {
    try {
      await api(`/admin/customers/${id}`, { method: 'PATCH', body });
      toast.success('Customer updated');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Customers
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-ink font-display text-xl font-bold text-white">{c.name[0]}</span>
        <div>
          <h1 className="text-[28px]">{c.name}</h1>
          <div className="text-sm text-muted">
            Customer since {date(c.createdAt)} · last seen {c.lastLoginAt ? timeAgo(c.lastLoginAt) : 'never'}
          </div>
        </div>
        {c.isBlocked && <Badge tone="danger">Blocked</Badge>}
        {c.role !== 'CUSTOMER' && <Badge tone="info">{c.role}</Badge>}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Lifetime spend', inr(s.spent)],
          ['Orders', s.orders],
          ['Average order', inr(s.aov)],
          ['Cancelled / returned', `${s.cancelled} / ${s.returned}`],
          ['Reward points', c.loyaltyPoints],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line">
            <div className="text-xs text-muted">{k}</div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Orders" padded={false}>
            <Table head={['Order', 'Date', 'Payment', 'Status', 'Total']}>
              {data.orders.map((o: any) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="text-muted">{dateTime(o.createdAt)}</td>
                  <td>{o.paymentMethod === 'COD' ? 'COD' : 'Online'}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="font-semibold tabular-nums">{inr(o.total)}</td>
                </tr>
              ))}
            </Table>
            {!data.orders.length && <p className="p-6 text-center text-sm text-muted">No orders yet.</p>}
          </Panel>
          {data.cart.length > 0 && (
            <Panel title="In their cart right now">
              <ul className="space-y-1.5 text-sm">
                {data.cart.map((i: any, k: number) => (
                  <li key={k} className="flex justify-between">
                    <span>
                      {i.name} {i.variant !== 'Default' && <span className="text-muted">({i.variant})</span>} × {i.quantity}
                    </span>
                    <span className="tabular-nums">{inr(i.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Messages sent" padded={false}>
            <Table head={['Channel', 'Message', 'Status', 'When']}>
              {data.notifications.map((n: any) => (
                <tr key={n.id}>
                  <td>{n.channel === 'WHATSAPP' ? 'WhatsApp' : n.channel === 'SMS' ? 'SMS' : 'Email'}</td>
                  <td className="text-muted">{n.template.toLowerCase().replace(/_/g, ' ')}</td>
                  <td>
                    <Badge tone={n.status === 'SENT' ? 'success' : n.status === 'FAILED' ? 'danger' : 'neutral'}>{n.status.toLowerCase()}</Badge>
                  </td>
                  <td className="text-muted">{timeAgo(n.createdAt)}</td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Contact">
            <div className="space-y-2 text-sm">
              {c.email && (
                <a href={`mailto:${c.email}`} className="flex items-center gap-2 hover:underline">
                  <Mail size={15} /> {c.email}
                </a>
              )}
              {c.phone && (
                <>
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:underline">
                    <Phone size={15} /> {c.phone} {c.phoneVerified && <Badge tone="success">verified</Badge>}
                  </a>
                  <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
                    <MessageCircle size={15} /> WhatsApp chat
                  </a>
                </>
              )}
            </div>
            <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
              <label className="flex items-center justify-between">
                WhatsApp updates <Toggle checked={c.whatsappOptIn} onChange={(v) => patch({ whatsappOptIn: v })} label="WhatsApp updates" />
              </label>
              <label className="flex items-center justify-between">
                Marketing emails <Toggle checked={c.marketingOptIn} onChange={(v) => patch({ marketingOptIn: v })} label="Marketing emails" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-danger">Block account</span> <Toggle checked={c.isBlocked} onChange={(v) => patch({ isBlocked: v })} label="Block account" />
              </label>
            </div>
          </Panel>
          {c.addresses.map((a: any) => (
            <Panel key={a.id} title={a.isDefault ? 'Default address' : 'Address'}>
              <p className="text-sm">
                {a.fullName}, {a.phone}
                <br />
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}
              </p>
            </Panel>
          ))}
          <Panel title="Adjust points">
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const r = await api<{ balance: number }>(`/admin/customers/${id}/loyalty`, { body: { points: Number(points), reason } });
                  toast.success(`New balance: ${r.balance} points`);
                  setPoints('');
                  setReason('');
                  reload();
                } catch (err) {
                  toast.error(errorMessage(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input className="field !h-9 text-sm" value={points} onChange={(e) => setPoints(e.target.value.replace(/[^\d-]/g, ''))} placeholder="+100 or -50" required aria-label="Points" />
              <input className="field !h-9 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. goodwill for delay)" required minLength={3} aria-label="Reason" />
              <button disabled={busy} className="btn btn-outline btn-sm w-full">
                {busy ? <Spinner size={14} /> : 'Apply'}
              </button>
            </form>
            <ul className="mt-4 max-h-56 space-y-1.5 overflow-y-auto text-xs">
              {data.loyalty.map((l: any) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="text-muted">{l.reason}</span>
                  <span className={`font-semibold ${l.points > 0 ? 'text-peacock' : 'text-rose'}`}>{l.points > 0 ? `+${l.points}` : l.points}</span>
                </li>
              ))}
            </ul>
          </Panel>
          {me?.role === 'ADMIN' && me.id !== c.id && (
            <Panel title="Access">
              <select
                value={c.role}
                onChange={async (e) => {
                  if (!confirm(`Change ${c.name}'s role to ${e.target.value}? They'll be signed out.`)) return;
                  try {
                    await api(`/admin/customers/${id}/role`, { body: { role: e.target.value } });
                    toast.success('Role updated');
                    reload();
                  } catch (err) {
                    toast.error(errorMessage(err));
                  }
                }}
                className="field !h-9 text-sm"
                aria-label="Role"
              >
                <option value="CUSTOMER">Customer</option>
                <option value="SUPPORT">Support (orders & customers)</option>
                <option value="MANAGER">Manager (+ catalog & marketing)</option>
                <option value="ADMIN">Admin (full access)</option>
              </select>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
