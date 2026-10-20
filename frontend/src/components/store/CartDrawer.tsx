'use client';

import Link from 'next/link';
import { ShoppingBag, Trash2, Truck } from 'lucide-react';
import { useCart } from '@/store/cart';
import { inr } from '@/lib/format';
import { Empty, Img, QtyStepper, Sheet } from '@/components/ui';

export function FreeShippingMeter({ remaining, subtotal }: { remaining: number; subtotal: number }) {
  const goal = subtotal + remaining;
  const pct = goal ? Math.min(100, Math.round((subtotal / goal) * 100)) : 100;
  return (
    <div className="rounded-[var(--radius-sm)] bg-peacock-soft px-3.5 py-3 text-[13px] text-peacock">
      <div className="flex items-center gap-2 font-semibold">
        <Truck size={16} />
        {remaining > 0 ? (
          <span>
            Add {inr(remaining)} more for <b>free delivery</b>
          </span>
        ) : (
          <span>You’ve unlocked free delivery</span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full bg-peacock transition-all duration-500" style={{ width: `${remaining > 0 ? pct : 100}%` }} />
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, setQuantity, remove, pending } = useCart();
  const lines = cart?.lines ?? [];

  return (
    <Sheet open={drawerOpen} onClose={closeDrawer} title={`Your cart${cart?.itemCount ? ` (${cart.itemCount})` : ''}`}>
      {!lines.length ? (
        <Empty
          icon={<ShoppingBag size={26} />}
          title="Your cart is empty"
          body="Browse bestsellers and today’s deals — everything ships fast."
          action={
            <Link href="/shop" onClick={closeDrawer} className="btn btn-primary">
              Start shopping
            </Link>
          }
        />
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex-1 space-y-4 p-5">
            <FreeShippingMeter remaining={cart!.freeShippingRemaining} subtotal={cart!.subtotal - cart!.discount} />
            {lines.map((l) => (
              <div key={l.variantId} className={`flex gap-3 ${pending === l.variantId ? 'opacity-60' : ''}`}>
                <Link href={`/product/${l.productSlug}`} onClick={closeDrawer} className="shrink-0">
                  <Img src={l.image} alt={l.productName} className="size-20 rounded-[var(--radius-sm)] bg-tile object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${l.productSlug}`} onClick={closeDrawer} className="line-clamp-2 text-sm font-medium leading-snug hover:underline">
                    {l.productName}
                  </Link>
                  {l.variantTitle !== 'Default' && <div className="mt-0.5 text-xs text-muted">{l.variantTitle}</div>}
                  {l.issue && <div className="mt-1 text-xs font-semibold text-danger">{l.issue}</div>}
                  <div className="mt-2 flex items-center justify-between">
                    <QtyStepper value={l.quantity} max={Math.min(10, l.stock)} onChange={(n) => setQuantity(l.variantId, n)} disabled={pending === l.variantId} />
                    <div className="text-right">
                      <div className="price text-[15px]">{inr(l.total)}</div>
                    </div>
                  </div>
                </div>
                <button onClick={() => remove(l.variantId)} className="self-start p-1 text-faint hover:text-danger" aria-label={`Remove ${l.productName}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="sticky bottom-0 border-t border-line bg-surface p-5">
            {cart!.savings > 0 && <div className="mb-2 text-sm font-semibold text-peacock">You’re saving {inr(cart!.savings)} on this order</div>}
            <div className="flex items-baseline justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="price text-xl">{inr(cart!.subtotal - cart!.discount)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Taxes included. Delivery and offers applied at checkout.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/cart" onClick={closeDrawer} className="btn btn-outline">
                View cart
              </Link>
              <Link href="/checkout" onClick={closeDrawer} className="btn btn-accent">
                Checkout
              </Link>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
