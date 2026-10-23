'use client';

import Link from 'next/link';
import { Heart, ShieldCheck, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import type { Offer } from '@/lib/types';
import { Empty, Img, QtyStepper } from '@/components/ui';
import { CouponBox, SummaryRows } from '@/components/store/OrderSummary';
import { FreeShippingMeter } from '@/components/store/CartDrawer';
import { offerLabel } from '@/lib/format';

export default function CartPage() {
  const { cart, loading, setQuantity, remove, applyCoupon, removeCoupon, pending } = useCart();
  const toggleWish = useWishlist((s) => s.toggle);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    api<{ offers: Offer[] }>('/cms/offers')
      .then((r) => setOffers(r.offers))
      .catch(() => undefined);
  }, []);

  if (!cart && loading) {
    return (
      <div className="container-x py-10">
        <div className="skeleton h-10 w-48" />
        <div className="mt-8 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!cart?.lines.length) {
    return (
      <div className="container-x py-10">
        <Empty
          icon={<ShoppingBag size={28} />}
          title="Your cart is empty"
          body="Looks like you haven’t added anything yet. Today’s deals are a good place to start."
          action={
            <div className="flex gap-2">
              <Link href="/shop?deals=true" className="btn btn-accent">
                See today’s deals
              </Link>
              <Link href="/account/wishlist" className="btn btn-outline">
                View wishlist
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-x py-4 md:py-6">
      <h1 className="text-[22px] md:text-[28px]">Your cart</h1>
      <div className="mt-4 grid gap-4 md:mt-5 md:gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <FreeShippingMeter remaining={cart.freeShippingRemaining} subtotal={cart.subtotal - cart.discount} />
          {cart.hasIssues && <p className="mt-4 rounded-[var(--radius-sm)] bg-rose-soft px-4 py-3 text-sm font-medium text-danger">Some items need your attention before checkout.</p>}
          <ul className="mt-4 divide-y divide-line rounded-[var(--radius)] bg-surface ring-1 ring-line">
            {cart.lines.map((l) => (
              <li key={l.variantId} className={`flex gap-4 p-4 sm:p-5 ${pending === l.variantId ? 'opacity-60' : ''}`}>
                <Link href={`/product/${l.productSlug}`} className="shrink-0">
                  <Img src={l.image} alt={l.productName} className="size-24 rounded-[var(--radius-sm)] bg-tile object-cover sm:size-28" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-4">
                    <div>
                      <Link href={`/product/${l.productSlug}`} className="font-medium hover:underline">
                        {l.productName}
                      </Link>
                      {l.variantTitle !== 'Default' && <div className="mt-0.5 text-sm text-muted">{l.variantTitle}</div>}
                    </div>
                    <div className="text-right">
                      <div className="price text-lg">{inr(l.total)}</div>
                      {l.compareAtPrice && l.compareAtPrice > l.price && <div className="text-xs text-faint line-through">{inr(l.compareAtPrice * l.quantity)}</div>}
                    </div>
                  </div>
                  {l.issue && <p className="mt-1 text-sm font-semibold text-danger">{l.issue}</p>}
                  {!l.issue && l.stock <= 5 && <p className="mt-1 text-xs font-semibold text-rose">Only {l.stock} left</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <QtyStepper value={l.quantity} max={Math.max(1, Math.min(10, l.stock))} onChange={(n) => setQuantity(l.variantId, n)} disabled={pending === l.variantId} />
                    <button
                      onClick={async () => {
                        await toggleWish(l.productId, l.productName);
                        await remove(l.variantId);
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      <Heart size={15} /> Move to wishlist
                    </button>
                    <button onClick={() => remove(l.variantId)} className="btn btn-ghost btn-sm text-danger">
                      <Trash2 size={15} /> Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius)] bg-surface p-5 ring-1 ring-line">
            <h2 className="mb-3 font-sans text-base font-semibold">Offers & coupons</h2>
            <CouponBox cart={cart} onApply={applyCoupon} onRemove={removeCoupon} />
            {cart.coupon && !cart.coupon.valid && <p className="mt-2 text-xs font-medium text-danger">{cart.coupon.message}</p>}
            {!cart.coupon?.valid && offers.length > 0 && (
              <div className="mt-3 space-y-2">
                {offers.slice(0, 3).map((o) => (
                  <button key={o.code} onClick={() => applyCoupon(o.code)} className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-dashed border-line px-3 py-2 text-left text-xs hover:border-ink">
                    <span>
                      <b className="text-sm">{o.code}</b> · {offerLabel(o)}
                    </span>
                    <span className="font-semibold text-peacock">Apply</span>
                  </button>
                ))}
              </div>
            )}
            <div className="my-5 border-t border-line" />
            <SummaryRows cart={cart} />
            <Link href="/checkout" aria-disabled={cart.hasIssues} className={`btn btn-accent btn-lg mt-5 w-full ${cart.hasIssues ? 'pointer-events-none opacity-50' : ''}`}>
              Proceed to checkout
            </Link>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <ShieldCheck size={14} /> Secure checkout · UPI, cards, netbanking & COD
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
