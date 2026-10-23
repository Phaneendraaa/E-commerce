'use client';

import { useState, type ReactNode } from 'react';
import { BadgePercent, X } from 'lucide-react';
import type { Cart } from '@/lib/types';
import { inr } from '@/lib/format';
import { Spinner } from '@/components/ui';

export function SummaryRows({ cart }: { cart: Cart }) {
  const row = (label: ReactNode, value: ReactNode, tone?: string) => (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular-nums ${tone ?? ''}`}>{value}</dd>
    </div>
  );
  const mrpSavings = cart.mrpTotal - cart.subtotal;
  return (
    <dl className="text-sm">
      {row(`Price (${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'})`, inr(cart.mrpTotal))}
      {mrpSavings > 0 && row('Discount on MRP', `− ${inr(mrpSavings)}`, 'text-peacock')}
      {cart.discount > 0 && row(`Coupon (${cart.coupon?.code})`, `− ${inr(cart.discount)}`, 'text-peacock')}
      {cart.loyaltyDiscount > 0 && row(`Reward points (${cart.loyaltyPointsUsed})`, `− ${inr(cart.loyaltyDiscount)}`, 'text-peacock')}
      {row('Delivery', cart.shippingFee ? inr(cart.shippingFee) : <span className="font-semibold text-peacock">Free</span>)}
      {cart.codFee > 0 && row('Cash on Delivery fee', inr(cart.codFee))}
      <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-line pt-3">
        <dt className="font-semibold">Total</dt>
        <dd className="price text-2xl">{inr(cart.total)}</dd>
      </div>
      <p className="mt-1 text-right text-xs text-muted">Includes {inr(cart.tax)} GST</p>
      {cart.savings > 0 && <p className="mt-3 rounded-[var(--radius-sm)] bg-peacock-soft px-3 py-2 text-center text-sm font-semibold text-peacock">You save {inr(cart.savings)} on this order</p>}
      {cart.pointsToEarn > 0 && <p className="mt-2 text-center text-xs text-muted">You’ll earn {cart.pointsToEarn} reward points once delivered</p>}
    </dl>
  );
}

export function CouponBox({ cart, onApply, onRemove }: { cart: Cart; onApply: (code: string) => Promise<boolean>; onRemove: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const applied = cart.coupon?.valid ? cart.coupon : null;

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-dashed border-peacock bg-peacock-soft px-3 py-2.5 text-sm">
        <div className="flex items-center gap-2">
          <BadgePercent size={18} className="text-peacock" />
          <div>
            <div className="font-bold">{applied.code}</div>
            <div className="text-xs text-peacock">{applied.message}</div>
          </div>
        </div>
        <button
          onClick={async () => {
            setBusy(true);
            await onRemove();
            setBusy(false);
          }}
          className="text-muted hover:text-danger"
          aria-label="Remove coupon"
        >
          {busy ? <Spinner size={15} /> : <X size={17} />}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        setBusy(true);
        if (await onApply(code.trim())) setCode('');
        setBusy(false);
      }}
    >
      <label className="sr-only" htmlFor="coupon">
        Coupon code
      </label>
      <input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="field !h-10 uppercase" />
      <button disabled={busy || !code} className="btn btn-outline btn-sm !h-10">
        {busy ? <Spinner size={15} /> : 'Apply'}
      </button>
    </form>
  );
}
