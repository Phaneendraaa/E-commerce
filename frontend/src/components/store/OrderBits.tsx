'use client';

import { Check } from 'lucide-react';
import type { Order, OrderStatus } from '@/lib/types';
import { STATUS_LABEL, STATUS_TONE, dateTime } from '@/lib/format';
import { Badge } from '@/components/ui';

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const FLOW: OrderStatus[] = ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/** Horizontal progress tracker for an order's fulfilment stages. */
export function OrderProgress({ order }: { order: Order }) {
  if (['CANCELLED', 'FAILED', 'PENDING_PAYMENT'].includes(order.status)) return null;
  const reached = (s: OrderStatus) => {
    const order_ = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'];
    return order_.indexOf(order.status) >= order_.indexOf(s);
  };
  const at = (s: OrderStatus) => order.history?.find((h) => h.status === s)?.createdAt;
  return (
    <ol className="grid grid-cols-5 gap-1">
      {FLOW.map((s, i) => {
        const done = reached(s);
        return (
          <li key={s} className="relative text-center">
            {i > 0 && <span className={`absolute right-1/2 top-3.5 h-[3px] w-full -translate-y-1/2 ${done ? 'bg-peacock' : 'bg-line'}`} aria-hidden />}
            <span className={`relative mx-auto grid size-7 place-items-center rounded-full text-xs font-bold ${done ? 'bg-peacock text-white' : 'bg-surface text-faint ring-2 ring-line'}`}>{done ? <Check size={14} /> : i + 1}</span>
            <div className={`mt-2 text-[11px] font-semibold sm:text-xs ${done ? '' : 'text-faint'}`}>{STATUS_LABEL[s]}</div>
            {at(s) && <div className="hidden text-[11px] text-muted sm:block">{dateTime(at(s))}</div>}
          </li>
        );
      })}
    </ol>
  );
}
