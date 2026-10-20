'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail, MessageCircle, Send, Smartphone } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { Loading, PageHeader, Pager, Panel, SearchInput, Table, useApi } from '@/components/admin/kit';
import { Badge, Spinner } from '@/components/ui';

const AUDIENCES = [
  { value: 'all', label: 'All customers (opted in)' },
  { value: 'buyers', label: 'Customers who bought' },
  { value: 'no_orders', label: 'Signed up, never ordered' },
  { value: 'inactive_60', label: 'Inactive for 60+ days' },
  { value: 'newsletter', label: 'Newsletter subscribers' },
];

function Broadcast() {
  const [audience, setAudience] = useState('inactive_60');
  const [channels, setChannels] = useState<string[]>(['EMAIL', 'WHATSAPP']);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ recipients: number; withEmail: number; withPhone: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const body = { audience, channels, subject, message };
  const dry = async () => {
    try {
      setPreview(await api('/admin/broadcast', { body: { ...body, subject: subject || 'Preview', message: message || 'Preview message', dryRun: true } }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Panel title="Send a broadcast" description="Marketing messages go only to customers who opted in. WhatsApp uses your approved “custom_update” template.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!confirm(`Send to ${preview?.recipients ?? 'the selected'} customers now?`)) return;
          setBusy(true);
          try {
            const r = await api<{ queued: number }>('/admin/broadcast', { body });
            toast.success(`Sending to ${r.queued} customers — watch the log below`);
            setSubject('');
            setMessage('');
            setPreview(null);
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="label">Audience</span>
            <select className="field" value={audience} onChange={(e) => (setAudience(e.target.value), setPreview(null))}>
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="label">Channels</legend>
            <div className="flex gap-2">
              {[
                ['EMAIL', 'Email'],
                ['WHATSAPP', 'WhatsApp'],
                ['SMS', 'SMS'],
              ].map(([v, l]) => (
                <button type="button" key={v} data-active={channels.includes(v)} onClick={() => setChannels((c) => (c.includes(v) ? c.filter((x) => x !== v) : [...c, v]))} className="chip">
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <label className="block">
          <span className="label">Subject (email)</span>
          <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} placeholder="We miss you — here’s 15% off" />
        </label>
        <label className="block">
          <span className="label">Message</span>
          <textarea className="field" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} required minLength={5} maxLength={1000} placeholder="Use code VIP15 for 15% off this week. Shop now at yourstore.com" />
          <span className="text-xs text-muted">{message.length}/1000 · SMS splits every 160 characters</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={dry} className="btn btn-outline btn-sm">
            Count recipients
          </button>
          {preview && (
            <span className="text-sm text-muted">
              <b className="text-ink">{preview.recipients}</b> recipients · {preview.withEmail} with email · {preview.withPhone} with phone
            </span>
          )}
          <button disabled={busy || !channels.length} className="btn btn-primary btn-sm ml-auto">
            {busy ? <Spinner size={14} /> : <Send size={14} />} Send broadcast
          </button>
        </div>
      </form>
    </Panel>
  );
}

export default function MessagingPage() {
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const log = useApi<any>('/admin/notifications', { channel, status, q, page, limit: 30 });
  const reminders = useApi<{ reminders: any[]; counts: Record<string, number> }>('/admin/reminders');
  const stats = useApi<any>('/admin/analytics/notifications', { days: 30 });

  return (
    <div>
      <PageHeader title="Messaging" description="Email, SMS and WhatsApp — every message the store sends is logged here" />

      {stats.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.data.byChannel.map((c: any) => (
            <div key={c.channel} className="rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line">
              <div className="flex items-center gap-2 text-xs text-muted">
                {c.channel === 'WHATSAPP' ? <MessageCircle size={14} /> : c.channel === 'SMS' ? <Smartphone size={14} /> : <Mail size={14} />}
                {c.channel === 'WHATSAPP' ? 'WhatsApp' : c.channel === 'SMS' ? 'SMS' : 'Email'} · 30 days
              </div>
              <div className="mt-1 font-display text-2xl font-bold">{c.total}</div>
              <div className="text-xs text-muted">
                {c.sent} sent · {c.failed} failed{c.skipped ? ` · ${c.skipped} not configured` : ''}
              </div>
            </div>
          ))}
          <div className="rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line">
            <div className="text-xs text-muted">WhatsApp read rate</div>
            <div className="mt-1 font-display text-2xl font-bold">{stats.data.whatsapp.readRate ?? '—'}%</div>
            <div className="text-xs text-muted">{stats.data.whatsapp.deliveryRate ?? '—'}% delivered</div>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Broadcast />
        <Panel title="Automated reminders" description="Order and tracking reminders run every minute from a durable queue">
          {reminders.data ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {Object.entries(reminders.data.counts).map(([k, v]) => (
                  <Badge key={k} tone={k === 'SENT' ? 'success' : k === 'PENDING' ? 'warn' : k === 'FAILED' ? 'danger' : 'neutral'}>
                    {k.toLowerCase()}: {v}
                  </Badge>
                ))}
              </div>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
                {reminders.data.reminders.slice(0, 40).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2">
                    <span className="flex-1">
                      {r.type.toLowerCase().replace(/_/g, ' ')}
                      {r.order && (
                        <Link href={`/admin/orders/${r.orderId}`} className="ml-1.5 text-xs text-muted underline">
                          {r.order.orderNumber}
                        </Link>
                      )}
                    </span>
                    <Badge tone={r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'warn' : r.status === 'FAILED' ? 'danger' : 'neutral'}>{r.status.toLowerCase()}</Badge>
                    <span className="w-28 text-right text-xs text-muted">{dateTime(r.sentAt ?? r.runAt)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Loading />
          )}
        </Panel>
      </div>

      <Panel title="Message log" className="mt-5" padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Email or phone" />
          <select value={channel} onChange={(e) => (setChannel(e.target.value), setPage(1))} className="field !h-9 !w-auto text-sm" aria-label="Channel">
            <option value="">All channels</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
          </select>
          <select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="field !h-9 !w-auto text-sm" aria-label="Status">
            <option value="">Any status</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Not configured</option>
          </select>
        </div>
        {!log.data ? (
          <Loading />
        ) : (
          <Table head={['When', 'Channel', 'To', 'Message', 'Order', 'Status']}>
            {log.data.items.map((n: any) => (
              <tr key={n.id}>
                <td className="whitespace-nowrap text-xs text-muted">{dateTime(n.createdAt)}</td>
                <td>{n.channel === 'WHATSAPP' ? 'WhatsApp' : n.channel === 'SMS' ? 'SMS' : 'Email'}</td>
                <td className="text-xs">{n.to}</td>
                <td>
                  <div className="font-medium">{n.template.toLowerCase().replace(/_/g, ' ')}</div>
                  <div className="line-clamp-1 max-w-sm text-xs text-muted">{n.subject ?? n.body}</div>
                </td>
                <td className="text-xs">{n.order ? <Link href={`/admin/orders/${n.orderId}`} className="underline">{n.order.orderNumber}</Link> : '—'}</td>
                <td>
                  <Badge tone={n.status === 'SENT' ? 'success' : n.status === 'FAILED' ? 'danger' : 'neutral'}>{n.deliveryStatus ?? (n.status === 'SKIPPED' ? 'not configured' : n.status.toLowerCase())}</Badge>
                  {n.status === 'FAILED' && n.error && <div className="mt-0.5 max-w-[200px] text-[11px] text-danger">{n.error}</div>}
                </td>
              </tr>
            ))}
          </Table>
        )}
        {log.data && <Pager page={log.data.page} totalPages={log.data.totalPages} total={log.data.total} onPage={setPage} />}
      </Panel>
    </div>
  );
}
