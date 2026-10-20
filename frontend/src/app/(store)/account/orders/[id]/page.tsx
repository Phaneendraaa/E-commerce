'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Copy, CreditCard, Download, ExternalLink, MessageCircle, RefreshCw, RotateCcw, Star, Truck, XCircle } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { STATUS_LABEL, date, dateTime, inr } from '@/lib/format';
import { pay } from '@/lib/razorpay';
import type { Order, PaymentIntent } from '@/lib/types';
import { useCart } from '@/store/cart';
import { Img, Sheet, Spinner } from '@/components/ui';
import { OrderProgress, StatusBadge } from '@/components/store/OrderBits';

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const reloadCart = useCart((s) => s.load);
  const openCart = useCart((s) => s.openDrawer);
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ order: Order }>(`/orders/${id}`)
      .then((r) => setOrder(r.order))
      .catch(() => setNotFound(true));
  }, [id]);
  useEffect(load, [load]);

  if (notFound)
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl">Order not found</h1>
        <Link href="/account/orders" className="btn btn-outline mt-4">
          Back to orders
        </Link>
      </div>
    );
  if (!order) return <div className="skeleton h-96" />;

  const a = order.shippingAddress;
  const inTransit = ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(order.status);

  const retryPay = async () => {
    setBusy(true);
    try {
      const r = await api<{ payment: PaymentIntent }>(`/orders/${order.id}/pay`, { method: 'POST' });
      const res = await pay(r.payment);
      if (res.status === 'paid') {
        toast.success('Payment received — your order is confirmed');
        router.push(`/order/success/${res.orderNumber}`);
      } else if (res.status === 'failed') toast.error(res.message);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      load();
    }
  };

  const reorder = async () => {
    setBusy(true);
    try {
      const r = await api<{ added: number; skipped: number }>(`/orders/${order.id}/reorder`, { method: 'POST' });
      await reloadCart();
      toast.success(`${r.added} item${r.added === 1 ? '' : 's'} added to your cart${r.skipped ? ` · ${r.skipped} unavailable` : ''}`);
      if (r.added) openCart();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> All orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] md:text-[36px]">Order {order.orderNumber}</h1>
          <p className="text-sm text-muted">Placed {dateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.status === 'PENDING_PAYMENT' && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] bg-marigold-soft p-5">
          <div>
            <div className="font-semibold">Payment pending</div>
            <div className="text-sm text-muted">Complete payment within 30 minutes of ordering, or the order will be cancelled automatically.</div>
          </div>
          <button onClick={retryPay} disabled={busy} className="btn btn-primary">
            {busy ? <Spinner /> : <CreditCard size={17} />} Pay {inr(order.total)}
          </button>
        </div>
      )}

      {order.status === 'CANCELLED' && (
        <div className="mt-6 rounded-[var(--radius)] bg-rose-soft p-5 text-sm">
          <b>Cancelled</b> {order.cancelledAt && `on ${date(order.cancelledAt)}`}. {order.cancelReason}
          {order.paymentStatus === 'REFUNDED' && <div className="mt-1">Your refund of {inr(order.total)} has been initiated (5–7 business days).</div>}
        </div>
      )}

      <div className="mt-6 rounded-[var(--radius)] bg-surface p-5 ring-1 ring-line sm:p-6">
        <OrderProgress order={order} />
        {order.trackingNumber && (
          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[var(--radius-sm)] bg-tile p-4">
            <Truck size={22} className="text-peacock" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">
                {order.carrier} · {order.trackingNumber}
                <button
                  onClick={() => (navigator.clipboard?.writeText(order.trackingNumber!), toast.success('Tracking number copied'))}
                  className="ml-2 inline-flex align-middle text-muted hover:text-ink"
                  aria-label="Copy tracking number"
                >
                  <Copy size={14} />
                </button>
              </div>
              <div className="text-muted">
                {order.deliveredAt ? `Delivered ${date(order.deliveredAt)}` : order.expectedDeliveryAt ? `Expected by ${date(order.expectedDeliveryAt, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'In transit'}
              </div>
            </div>
            {order.trackingUrl && (
              <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                Track on {order.carrier} <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}
        {inTransit && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <MessageCircle size={14} /> We’ll remind you on WhatsApp while your parcel is on its way.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="self-start rounded-[var(--radius)] bg-surface ring-1 ring-line">
          <ul className="divide-y divide-line">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 p-4">
                <Img src={i.image} alt="" className="size-20 rounded-[var(--radius-sm)] bg-tile object-cover" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{i.name}</div>
                  <div className="text-muted">
                    {i.variantTitle !== 'Default' ? `${i.variantTitle} · ` : ''}Qty {i.quantity} · {inr(i.price)} each
                  </div>
                  {order.status === 'DELIVERED' && i.productSlug && (
                    <Link href={`/product/${i.productSlug}#reviews`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-peacock hover:underline">
                      <Star size={13} /> Rate this product
                    </Link>
                  )}
                </div>
                <div className="price">{inr(i.total)}</div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            {order.canCancel && (
              <button onClick={() => setCancelOpen(true)} className="btn btn-ghost btn-sm text-danger">
                <XCircle size={16} /> Cancel order
              </button>
            )}
            {order.canReturn && (
              <button onClick={() => setReturnOpen(true)} className="btn btn-outline btn-sm">
                <RotateCcw size={16} /> Return items
              </button>
            )}
            {!['PENDING_PAYMENT', 'FAILED'].includes(order.status) && (
              <a href={`/api/orders/${order.id}/invoice`} target="_blank" className="btn btn-ghost btn-sm">
                <Download size={16} /> Invoice
              </a>
            )}
            <button onClick={reorder} disabled={busy} className="btn btn-ghost btn-sm">
              <RefreshCw size={16} /> Buy again
            </button>
          </div>
          {order.returns?.map((r) => (
            <div key={r.id} className="border-t border-line bg-tile/60 p-4 text-sm">
              Return request · <b>{r.status.replace('_', ' ').toLowerCase()}</b> · {r.reason}
              {r.refundAmount ? ` · refund ${inr(r.refundAmount)}` : ''}
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-[var(--radius)] bg-surface p-5 text-sm ring-1 ring-line">
            <h2 className="font-sans text-base font-semibold">Delivery address</h2>
            <p className="mt-2">
              <b>{a.fullName}</b>
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              Phone: {a.phone}
            </p>
          </div>
          <div className="rounded-[var(--radius)] bg-surface p-5 text-sm ring-1 ring-line">
            <h2 className="font-sans text-base font-semibold">Payment summary</h2>
            <dl className="mt-3 space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-muted">Items</dt>
                <dd>{inr(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-peacock">
                  <dt>Coupon {order.couponCode}</dt>
                  <dd>− {inr(order.discount)}</dd>
                </div>
              )}
              {order.loyaltyDiscount > 0 && (
                <div className="flex justify-between text-peacock">
                  <dt>Reward points</dt>
                  <dd>− {inr(order.loyaltyDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Delivery</dt>
                <dd>{order.shippingFee ? inr(order.shippingFee) : 'Free'}</dd>
              </div>
              {order.codFee > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">COD fee</dt>
                  <dd>{inr(order.codFee)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="price text-lg">{inr(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">
              {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'} · {order.paymentStatus.toLowerCase().replace('_', ' ')}
            </p>
          </div>
          {!!order.history?.length && (
            <div className="rounded-[var(--radius)] bg-surface p-5 text-sm ring-1 ring-line">
              <h2 className="font-sans text-base font-semibold">Activity</h2>
              <ol className="mt-3 space-y-3 border-l-2 border-line pl-4">
                {[...order.history]
                  .reverse()
                  .filter((h) => !h.note?.startsWith('📝'))
                  .map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -left-[22px] top-1 size-2.5 rounded-full bg-ink" />
                      <div className="font-medium">{STATUS_LABEL[h.status]}</div>
                      {h.note && <div className="text-muted">{h.note}</div>}
                      <div className="text-xs text-faint">{dateTime(h.createdAt)}</div>
                    </li>
                  ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <CancelSheet open={cancelOpen} onClose={() => setCancelOpen(false)} order={order} onDone={load} />
      <ReturnSheet open={returnOpen} onClose={() => setReturnOpen(false)} order={order} onDone={load} />
    </div>
  );
}

function CancelSheet({ open, onClose, order, onDone }: { open: boolean; onClose: () => void; order: Order; onDone: () => void }) {
  const reasons = ['Ordered by mistake', 'Found a better price elsewhere', 'Delivery is taking too long', 'Want to change size or colour', 'Other'];
  const [reason, setReason] = useState(reasons[0]);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="Cancel this order?" side="center" width="max-w-md">
      <div className="space-y-2 p-5">
        {reasons.map((r) => (
          <label key={r} className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] p-2.5 text-sm hover:bg-tile">
            <input type="radio" name="reason" className="size-4 accent-[var(--ink)]" checked={reason === r} onChange={() => setReason(r)} /> {r}
          </label>
        ))}
        {order.paymentStatus === 'PAID' && <p className="pt-2 text-sm text-muted">Your refund of {inr(order.total)} will be initiated immediately.</p>}
        <div className="flex gap-2 pt-3">
          <button onClick={onClose} className="btn btn-outline flex-1">
            Keep order
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ message: string }>(`/orders/${order.id}/cancel`, { body: { reason } });
                toast.success(r.message);
                onClose();
                onDone();
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
            className="btn flex-1 bg-danger text-white"
          >
            {busy ? <Spinner /> : 'Cancel order'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function ReturnSheet({ open, onClose, order, onDone }: { open: boolean; onClose: () => void; order: Order; onDone: () => void }) {
  const reasons = ['Size or fit issue', 'Damaged or defective', 'Not as described', 'Received wrong item', 'Quality not as expected'];
  const [items, setItems] = useState<Set<string>>(new Set(order.items.map((i) => i.id)));
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const refund = order.items.filter((i) => items.has(i.id)).reduce((s, i) => s + i.total, 0);
  return (
    <Sheet open={open} onClose={onClose} title="Return items" side="center" width="max-w-lg">
      <div className="space-y-4 p-5">
        <div>
          <div className="label">Which items?</div>
          {order.items.map((i) => (
            <label key={i.id} className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] p-2 hover:bg-tile">
              <input
                type="checkbox"
                className="size-4 accent-[var(--ink)]"
                checked={items.has(i.id)}
                onChange={() => {
                  const n = new Set(items);
                  if (n.has(i.id)) n.delete(i.id);
                  else n.add(i.id);
                  setItems(n);
                }}
              />
              <Img src={i.image} alt="" className="size-10 rounded-md bg-tile object-cover" />
              <span className="flex-1 text-sm">{i.name}</span>
              <span className="text-sm">{inr(i.total)}</span>
            </label>
          ))}
        </div>
        <label className="block">
          <span className="label">Reason</span>
          <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
            {reasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">
            Anything else? <span className="font-normal text-muted">(optional)</span>
          </span>
          <textarea className="field" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
        </label>
        <p className="text-sm text-muted">
          Estimated refund: <b className="text-ink">{inr(refund)}</b>. We’ll arrange a free pickup within 2 business days.
        </p>
        <button
          disabled={busy || !items.size}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ message: string }>(`/orders/${order.id}/return`, { body: { itemIds: [...items], reason, details: details || undefined } });
              toast.success(r.message);
              onClose();
              onDone();
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
          className="btn btn-primary w-full"
        >
          {busy ? <Spinner /> : 'Request return'}
        </button>
      </div>
    </Sheet>
  );
}
