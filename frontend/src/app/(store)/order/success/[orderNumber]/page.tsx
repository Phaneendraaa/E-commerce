'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MessageCircle, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { date, inr } from '@/lib/format';
import type { Order } from '@/lib/types';
import { Img } from '@/components/ui';

export default function OrderSuccessPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    api<{ order: Order }>(`/orders/${orderNumber}`)
      .then((r) => setOrder(r.order))
      .catch(() => undefined);
  }, [orderNumber]);

  const eta = order ? new Date(new Date(order.createdAt).getTime() + 4 * 86_400_000) : null;

  return (
    <div className="container-x py-12 md:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="animate-rise text-center">
          <CheckCircle2 size={56} className="mx-auto text-peacock" strokeWidth={1.75} />
          <h1 className="mt-5 text-[24px] md:text-[32px]">Order placed!</h1>
          <p className="mt-3 text-muted">
            Order <b className="text-ink">{orderNumber}</b> is confirmed. We’ve sent the details to your email and WhatsApp.
          </p>
        </div>

        {order && (
          <div className="mt-10 rounded-[var(--radius)] border border-line bg-surface p-4">
            <div className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <div className="text-muted">Estimated delivery</div>
                <div className="mt-0.5 font-semibold">{date(eta, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
              </div>
              <div>
                <div className="text-muted">Payment</div>
                <div className="mt-0.5 font-semibold">{order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'}</div>
              </div>
              <div>
                <div className="text-muted">Total</div>
                <div className="price mt-0.5 text-lg">{inr(order.total)}</div>
              </div>
            </div>
            <ul className="mt-6 divide-y divide-line border-t border-line">
              {order.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
                  <Img src={i.image} alt="" className="size-12 rounded-[var(--radius-sm)] bg-tile object-cover" />
                  <span className="flex-1">
                    {i.name}
                    {i.variantTitle !== 'Default' && <span className="text-muted"> · {i.variantTitle}</span>} × {i.quantity}
                  </span>
                  <span className="price">{inr(i.total)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-sm)] bg-peacock-soft p-4 text-sm text-peacock">
              <MessageCircle size={18} className="mt-0.5 shrink-0" />
              <span>
                You’ll get shipping and tracking updates on WhatsApp. Reply <b>TRACK</b> any time to get your latest order status.
              </span>
            </div>
            {order.loyaltyPointsEarned === 0 && order.total >= 10000 && <p className="mt-3 text-center text-xs text-muted">Reward points will be added once your order is delivered.</p>}
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/account/orders/${orderNumber}`} className="btn btn-primary">
            <Package size={17} /> Track order
          </Link>
          <Link href="/shop" className="btn btn-outline">
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
