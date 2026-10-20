'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Bell, Copy, Download, ExternalLink, Mail, MessageCircle, Phone, Send, Smartphone, StickyNote, Truck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { STATUS_LABEL, date, dateTime, inr, timeAgo } from '@/lib/format';
import type { OrderStatus } from '@/lib/types';
import { ErrorNote, Loading, Panel, useApi } from '@/components/admin/kit';
import { StatusBadge } from '@/components/store/OrderBits';
import { Badge, Img, Sheet, Spinner } from '@/components/ui';

const CARRIERS: Record<string, string> = {
  Delhivery: 'https://www.delhivery.com/track/package/{awb}',
  'Blue Dart': 'https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo={awb}',
  Ekart: 'https://ekartlogistics.com/shipmenttrack/{awb}',
  XpressBees: 'https://www.xpressbees.com/shipment/tracking?awbNo={awb}',
  DTDC: 'https://www.dtdc.in/tracking.asp?strCnno={awb}',
  'India Post': 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx',
  Shiprocket: 'https://shiprocket.co/tracking/{awb}',
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'Mark processing',
  PACKED: 'Mark packed',
  SHIPPED: 'Ship order',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Mark delivered',
  CONFIRMED: 'Confirm order',
  RETURNED: 'Mark returned',
  REFUNDED: 'Refund',
};

export default function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload } = useApi<{ order: any }>(`/admin/orders/${id}`);
  const [ship, setShip] = useState(false);
  const [msg, setMsg] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const o = data.order;
  const a = o.shippingAddress;

  const transition = async (status: OrderStatus) => {
    if (status === 'SHIPPED') return setShip(true);
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      if (!confirm(status === 'CANCELLED' ? 'Cancel this order? Stock, coupon and points are restored; prepaid orders are refunded.' : `Refund ${inr(o.total)} to the customer?`)) return;
    }
    setBusy(status);
    try {
      await api(`/admin/orders/${o.id}/status`, { body: { status, cancelReason: status === 'CANCELLED' ? 'Cancelled by store' : undefined } });
      toast.success(`Order marked ${STATUS_LABEL[status].toLowerCase()}`);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const sendTemplate = async (template: string, channels: string[]) => {
    setBusy(template);
    try {
      const r = await api<{ results: { channel: string; status: string; error?: string }[] }>(`/admin/orders/${o.id}/notify`, { body: { template, channels } });
      const sent = r.results.filter((x) => x.status === 'SENT').length;
      const skipped = r.results.filter((x) => x.status === 'SKIPPED').length;
      toast.success(sent ? `Sent on ${sent} channel${sent === 1 ? '' : 's'}` : skipped ? 'Logged (provider not configured yet)' : 'Could not send — see the message log');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    await api(`/admin/orders/${o.id}/note`, { body: { note } });
    setNote('');
    reload();
  };

  const primary = o.allowedTransitions.filter((s: OrderStatus) => !['CANCELLED', 'FAILED', 'RETURN_REQUESTED'].includes(s));
  const canCancel = o.allowedTransitions.includes('CANCELLED');

  return (
    <div>
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Orders
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] md:text-[34px]">{o.orderNumber}</h1>
        <StatusBadge status={o.status} />
        <Badge tone={o.paymentStatus === 'PAID' ? 'success' : o.paymentStatus === 'REFUNDED' ? 'neutral' : 'warn'}>
          {o.paymentMethod === 'COD' ? 'COD' : 'Online'} · {o.paymentStatus.toLowerCase()}
        </Badge>
        <span className="text-sm text-muted">Placed {dateTime(o.createdAt)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          {primary.map((s: OrderStatus) => (
            <button key={s} onClick={() => transition(s)} disabled={busy !== null} className={`btn btn-sm ${s === primary[0] ? 'btn-primary' : 'btn-outline'}`}>
              {busy === s ? <Spinner size={14} /> : s === 'SHIPPED' ? <Truck size={15} /> : null} {NEXT_LABEL[s] ?? STATUS_LABEL[s]}
            </button>
          ))}
          {canCancel && (
            <button onClick={() => transition('CANCELLED')} className="btn btn-ghost btn-sm text-danger">
              Cancel
            </button>
          )}
          <a href={`/api/admin/orders/${o.id}/invoice`} target="_blank" className="btn btn-ghost btn-sm">
            <Download size={15} /> Invoice
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Panel title={`Items (${o.items.length})`} padded={false}>
            <ul className="divide-y divide-line">
              {o.items.map((i: any) => (
                <li key={i.id} className="flex items-center gap-4 px-5 py-3">
                  <Img src={i.image} alt="" className="size-14 rounded-md bg-tile object-cover" />
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/admin/products/${i.productId}`} className="font-medium hover:underline">
                      {i.name}
                    </Link>
                    <div className="text-muted">
                      {i.variantTitle !== 'Default' ? `${i.variantTitle} · ` : ''}SKU {i.sku}
                    </div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <div>
                      {inr(i.price)} × {i.quantity}
                    </div>
                    <div className="font-semibold">{inr(i.total)}</div>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
              {[
                ['Subtotal', inr(o.subtotal)],
                ...(o.discount ? [[`Coupon ${o.couponCode}`, `− ${inr(o.discount)}`]] : []),
                ...(o.loyaltyDiscount ? [[`Points (${o.loyaltyPointsUsed})`, `− ${inr(o.loyaltyDiscount)}`]] : []),
                ['Shipping', o.shippingFee ? inr(o.shippingFee) : 'Free'],
                ...(o.codFee ? [['COD fee', inr(o.codFee)]] : []),
                ['GST included', inr(o.tax)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted">{k}</dt>
                  <dd className="tabular-nums">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{inr(o.total)}</dd>
              </div>
              <div className="flex justify-between text-xs text-muted">
                <dt>Estimated gross profit</dt>
                <dd className="tabular-nums">{inr(o.profit)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="Shipment & tracking"
            description="Tracking is handled by the courier — we store the AWB and send WhatsApp reminders while it’s in transit"
            actions={
              o.trackingNumber && (
                <button onClick={() => setShip(true)} className="btn btn-ghost btn-sm">
                  Edit
                </button>
              )
            }
          >
            {o.trackingNumber ? (
              <div className="flex flex-wrap items-center gap-4">
                <Truck size={24} className="text-peacock" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold">
                    {o.carrier} · {o.trackingNumber}
                    <button onClick={() => (navigator.clipboard.writeText(o.trackingNumber), toast.success('AWB copied'))} className="ml-2 inline align-middle text-muted" aria-label="Copy AWB">
                      <Copy size={13} />
                    </button>
                  </div>
                  <div className="text-muted">
                    Shipped {date(o.shippedAt)}
                    {o.expectedDeliveryAt && ` · ETA ${date(o.expectedDeliveryAt)}`}
                    {o.deliveredAt && ` · Delivered ${date(o.deliveredAt)}`}
                  </div>
                </div>
                {o.trackingUrl && (
                  <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                    Open tracking <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">Not shipped yet. Use “Ship order” to add the courier and AWB — the customer is notified on WhatsApp, SMS and email.</p>
            )}
            {o.reminders.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold text-muted">Scheduled reminders</div>
                <ul className="space-y-1.5 text-sm">
                  {o.reminders.map((r: any) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <Bell size={14} className="text-muted" />
                      <span className="flex-1">{r.type.toLowerCase().replace(/_/g, ' ')}</span>
                      <Badge tone={r.status === 'SENT' ? 'success' : r.status === 'PENDING' ? 'warn' : r.status === 'FAILED' ? 'danger' : 'neutral'}>{r.status.toLowerCase()}</Badge>
                      <span className="w-32 text-right text-xs text-muted">{dateTime(r.sentAt ?? r.runAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel
            title="Customer messages"
            actions={
              <button onClick={() => setMsg(true)} className="btn btn-primary btn-sm">
                <Send size={14} /> Message customer
              </button>
            }
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                ['TRACKING_REMINDER', 'Send tracking reminder', ['WHATSAPP']],
                ['ORDER_SHIPPED', 'Resend shipping details', ['WHATSAPP', 'SMS', 'EMAIL']],
                ['OUT_FOR_DELIVERY', 'Out-for-delivery alert', ['WHATSAPP', 'SMS']],
                ['PAYMENT_PENDING', 'Payment reminder', ['WHATSAPP', 'EMAIL']],
                ['REVIEW_REQUEST', 'Ask for a review', ['WHATSAPP', 'EMAIL']],
              ]
                .filter(([t]) => (t === 'PAYMENT_PENDING' ? o.status === 'PENDING_PAYMENT' : t === 'REVIEW_REQUEST' ? o.status === 'DELIVERED' : t === 'ORDER_SHIPPED' || t === 'TRACKING_REMINDER' ? Boolean(o.trackingNumber) : t === 'OUT_FOR_DELIVERY' ? o.status === 'OUT_FOR_DELIVERY' : true))
                .map(([t, l, ch]) => (
                  <button key={t as string} disabled={busy !== null} onClick={() => sendTemplate(t as string, ch as string[])} className="chip">
                    {busy === t ? <Spinner size={13} /> : <MessageCircle size={14} />} {l as string}
                  </button>
                ))}
            </div>
            <ul className="divide-y divide-line text-sm">
              {o.notifications.slice(0, 12).map((n: any) => (
                <li key={n.id} className="flex items-start gap-3 py-2.5">
                  {n.channel === 'WHATSAPP' ? <MessageCircle size={16} className="mt-0.5 text-peacock" /> : n.channel === 'SMS' ? <Smartphone size={16} className="mt-0.5 text-muted" /> : <Mail size={16} className="mt-0.5 text-muted" />}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{n.template.toLowerCase().replace(/_/g, ' ')}</div>
                    {n.body && <div className="line-clamp-2 text-xs text-muted">{n.body}</div>}
                    {n.error && n.status !== 'SKIPPED' && <div className="text-xs text-danger">{n.error}</div>}
                  </div>
                  <div className="text-right">
                    <Badge tone={n.status === 'SENT' ? 'success' : n.status === 'FAILED' ? 'danger' : 'neutral'}>{n.deliveryStatus ?? n.status.toLowerCase()}</Badge>
                    <div className="mt-0.5 text-[11px] text-muted">{timeAgo(n.createdAt)}</div>
                  </div>
                </li>
              ))}
              {!o.notifications.length && <li className="py-4 text-muted">No messages sent yet.</li>}
            </ul>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Customer">
            <Link href={`/admin/customers/${o.user.id}`} className="font-semibold hover:underline">
              {o.user.name}
            </Link>
            <div className="mt-1 space-y-1 text-sm text-muted">
              {o.user.email && (
                <a href={`mailto:${o.user.email}`} className="flex items-center gap-2 hover:text-ink">
                  <Mail size={14} /> {o.user.email}
                </a>
              )}
              <a href={`tel:${a.phone}`} className="flex items-center gap-2 hover:text-ink">
                <Phone size={14} /> {a.phone}
              </a>
              <a href={`https://wa.me/91${a.phone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-ink">
                <MessageCircle size={14} /> Open WhatsApp chat
              </a>
            </div>
            <div className="mt-3 rounded-[var(--radius-sm)] bg-tile p-3 text-xs">
              {o.customerStats.orders} orders · {inr(o.customerStats.spent)} lifetime · {o.user.loyaltyPoints} points
              {!o.user.whatsappOptIn && <div className="mt-1 text-danger">Opted out of WhatsApp updates</div>}
            </div>
          </Panel>
          <Panel title="Delivery address">
            <p className="text-sm">
              <b>{a.fullName}</b>
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              {a.landmark ? `, near ${a.landmark}` : ''}
              <br />
              {a.city}, {a.state} {a.pincode}
            </p>
            {o.customerNote && <p className="mt-3 rounded-[var(--radius-sm)] bg-marigold-soft p-3 text-sm">“{o.customerNote}”</p>}
          </Panel>
          {(o.utmSource || o.device) && (
            <Panel title="Attribution">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-muted">Source</dt>
                <dd>{o.utmSource ?? 'direct'}</dd>
                <dt className="text-muted">Medium</dt>
                <dd>{o.utmMedium ?? '—'}</dd>
                <dt className="text-muted">Campaign</dt>
                <dd>{o.utmCampaign ?? '—'}</dd>
                <dt className="text-muted">Device</dt>
                <dd className="capitalize">{o.device ?? '—'}</dd>
              </dl>
            </Panel>
          )}
          <Panel title="Timeline">
            <form onSubmit={addNote} className="mb-4 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note" className="field !h-9 text-sm" aria-label="Internal note" />
              <button className="btn btn-outline btn-sm !h-9" aria-label="Save note">
                <StickyNote size={15} />
              </button>
            </form>
            <ol className="space-y-3 border-l-2 border-line pl-4 text-sm">
              {[...o.history].reverse().map((h: any) => (
                <li key={h.id} className="relative">
                  <span className={`absolute -left-[22px] top-1 size-2.5 rounded-full ${h.note?.startsWith('📝') ? 'bg-marigold' : 'bg-ink'}`} />
                  <div className="font-medium">{h.note?.startsWith('📝') ? 'Note' : STATUS_LABEL[h.status as OrderStatus]}</div>
                  {h.note && <div className="text-muted">{h.note.replace('📝 ', '')}</div>}
                  <div className="text-xs text-faint">{dateTime(h.createdAt)}</div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <ShipSheet open={ship} onClose={() => setShip(false)} order={o} onDone={reload} />
      <MessageSheet open={msg} onClose={() => setMsg(false)} order={o} onDone={reload} />
    </div>
  );
}

function ShipSheet({ open, onClose, order, onDone }: { open: boolean; onClose: () => void; order: any; onDone: () => void }) {
  const editing = Boolean(order.trackingNumber);
  const [carrier, setCarrier] = useState(order.carrier ?? 'Delhivery');
  const [awb, setAwb] = useState(order.trackingNumber ?? '');
  const [url, setUrl] = useState(order.trackingUrl ?? '');
  const [eta, setEta] = useState(order.expectedDeliveryAt?.slice(0, 10) ?? new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10));
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const autoUrl = (c: string, a: string) => (CARRIERS[c] && a ? CARRIERS[c].replace('{awb}', encodeURIComponent(a)) : '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const trackingUrl = url || autoUrl(carrier, awb);
      if (editing) {
        await api(`/admin/orders/${order.id}/tracking`, { method: 'PATCH', body: { carrier, trackingNumber: awb, trackingUrl, expectedDeliveryAt: eta || undefined, resend: notify } });
        toast.success('Tracking updated');
      } else {
        await api(`/admin/orders/${order.id}/status`, { body: { status: 'SHIPPED', carrier, trackingNumber: awb, trackingUrl, expectedDeliveryAt: eta || undefined, notifyCustomer: notify } });
        toast.success('Order shipped — customer notified');
      }
      onClose();
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit tracking' : 'Ship order'} side="center" width="max-w-lg">
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className="block">
          <span className="label">Courier</span>
          <input list="carriers" className="field" value={carrier} onChange={(e) => setCarrier(e.target.value)} required />
          <datalist id="carriers">
            {Object.keys(CARRIERS).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="label">Tracking number (AWB)</span>
          <input className="field" value={awb} onChange={(e) => setAwb(e.target.value.trim())} required />
        </label>
        <label className="block">
          <span className="label">
            Tracking link <span className="font-normal text-muted">(auto-filled for known couriers)</span>
          </span>
          <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={autoUrl(carrier, awb) || 'https://…'} type="url" />
        </label>
        <label className="block">
          <span className="label">Expected delivery</span>
          <input type="date" className="field" value={eta} onChange={(e) => setEta(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          {editing ? 'Resend tracking details on WhatsApp & SMS' : 'Notify customer on WhatsApp, SMS and email'}
        </label>
        {!editing && <p className="text-xs text-muted">We’ll also schedule a WhatsApp tracking reminder in 48 hours and a follow-up if delivery runs late.</p>}
        <button disabled={busy} className="btn btn-primary w-full">
          {busy ? <Spinner /> : editing ? 'Save tracking' : 'Mark as shipped'}
        </button>
      </form>
    </Sheet>
  );
}

function MessageSheet({ open, onClose, order, onDone }: { open: boolean; onClose: () => void; order: any; onDone: () => void }) {
  const [text, setText] = useState('');
  const [channels, setChannels] = useState<string[]>(['WHATSAPP']);
  const [busy, setBusy] = useState(false);
  const toggle = (c: string) => setChannels((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));
  return (
    <Sheet open={open} onClose={onClose} title={`Message ${order.user.name.split(' ')[0]}`} side="center" width="max-w-lg">
      <form
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api<{ results: { channel: string; status: string; error?: string }[] }>(`/admin/orders/${order.id}/notify`, { body: { template: 'CUSTOM', channels, message: text } });
            const failed = r.results.find((x) => x.status === 'FAILED');
            if (failed) toast.error(`${failed.channel}: ${failed.error}`);
            else toast.success('Message sent');
            setText('');
            onClose();
            onDone();
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <textarea className="field" rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} required placeholder={`Hi ${order.user.name.split(' ')[0]}, your order ${order.orderNumber}…`} />
        <div className="flex flex-wrap gap-2">
          {['WHATSAPP', 'SMS', 'EMAIL'].map((c) => (
            <button type="button" key={c} onClick={() => toggle(c)} data-active={channels.includes(c)} className="chip">
              {c === 'WHATSAPP' ? 'WhatsApp' : c === 'SMS' ? 'SMS' : 'Email'}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">WhatsApp-only messages are sent as free text, which Meta delivers only within 24 hours of the customer’s last message. With other channels, the approved “custom_update” template is used.</p>
        <button disabled={busy || !channels.length} className="btn btn-primary w-full">
          {busy ? <Spinner /> : 'Send'}
        </button>
      </form>
    </Sheet>
  );
}
