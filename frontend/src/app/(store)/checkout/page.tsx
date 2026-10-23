'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Check, CreditCard, Gift, Lock, MapPin, Plus } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { inr } from '@/lib/format';
import { device, sessionId, track, utm } from '@/lib/track';
import { pay } from '@/lib/razorpay';
import type { Address, Cart, PaymentIntent } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useCart } from '@/store/cart';
import { AddressForm, type AddressInput } from '@/components/store/AddressForm';
import { CouponBox, SummaryRows } from '@/components/store/OrderSummary';
import { Img, Sheet, Spinner } from '@/components/ui';

type Method = 'RAZORPAY' | 'COD';

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius)] bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="mb-4 flex items-center gap-3 font-sans text-lg font-semibold">
        <span className={`grid size-7 place-items-center rounded-full text-sm font-bold ${done ? 'bg-peacock text-white' : 'bg-ink text-white'}`}>{done ? <Check size={15} /> : n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CheckoutInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, status } = useAuth();
  const reloadCart = useCart((s) => s.load);
  const applyCartCoupon = useCart((s) => s.applyCoupon);
  const removeCartCoupon = useCart((s) => s.removeCoupon);

  // Buy-now mode: ?buy=variantId:qty
  const buyNow = useMemo(() => {
    const raw = params.get('buy');
    if (!raw) return null;
    const [variantId, q] = raw.split(':');
    return [{ variantId, quantity: Math.max(1, Math.min(10, Number(q) || 1)) }];
  }, [params]);

  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [method, setMethod] = useState<Method>('RAZORPAY');
  const [usePoints, setUsePoints] = useState(false);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Cart | null>(null);
  const [placing, setPlacing] = useState(false);
  const [mockIntent, setMockIntent] = useState<{ intent: PaymentIntent; resolve: (ok: boolean) => void } | null>(null);

  useEffect(() => {
    if (status === 'guest') router.replace(`/login?next=${encodeURIComponent('/checkout' + (params.get('buy') ? `?buy=${params.get('buy')}` : ''))}`);
  }, [status, router, params]);

  useEffect(() => {
    if (status !== 'authed') return;
    api<{ addresses: Address[] }>('/users/me/addresses').then((r) => {
      setAddresses(r.addresses);
      setAddressId(r.addresses.find((a) => a.isDefault)?.id ?? r.addresses[0]?.id ?? null);
      if (!r.addresses.length) setAdding(true);
    });
    track({ type: 'BEGIN_CHECKOUT' });
  }, [status]);

  const refreshQuote = useCallback(async () => {
    if (status !== 'authed') return;
    const points = usePoints ? 1_000_000 : 0; // server caps to the allowed maximum
    try {
      if (buyNow) {
        const r = await api<{ cart: Cart }>('/cart/quote', { body: { items: buyNow, couponCode: coupon, paymentMethod: method, loyaltyPoints: points } });
        setQuote(r.cart);
      } else {
        const r = await api<{ cart: Cart }>('/cart', { query: { paymentMethod: method, loyaltyPoints: points } });
        setQuote(r.cart);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }, [status, buyNow, coupon, method, usePoints]);

  useEffect(() => {
    void refreshQuote();
  }, [refreshQuote]);

  useEffect(() => {
    if (quote && !quote.codAvailable && method === 'COD') setMethod('RAZORPAY');
  }, [quote, method]);

  const saveAddress = async (a: AddressInput) => {
    const r = await api<{ address: Address }>('/users/me/addresses', { body: a });
    setAddresses((list) => [r.address, ...(list ?? []).map((x) => (r.address.isDefault ? { ...x, isDefault: false } : x))]);
    setAddressId(r.address.id);
    setAdding(false);
    toast.success('Address saved');
  };

  const confirmMock = (intent: PaymentIntent) => new Promise<boolean>((resolve) => setMockIntent({ intent, resolve }));

  const placeOrder = async () => {
    if (!addressId) return toast.error('Choose a delivery address');
    if (!quote?.lines.length) return;
    setPlacing(true);
    track({ type: 'ADD_PAYMENT_INFO', value: quote.total, meta: { method } });
    try {
      const u = utm();
      const r = await api<{ order: { id: string; orderNumber: string }; payment: PaymentIntent | null }>('/orders/checkout', {
        body: {
          addressId,
          paymentMethod: method,
          couponCode: buyNow ? coupon : undefined,
          loyaltyPoints: quote.loyaltyPointsUsed || undefined,
          note: note || undefined,
          items: buyNow ?? undefined,
          attribution: { utmSource: u?.source, utmMedium: u?.medium, utmCampaign: u?.campaign, device: device(), sessionId: sessionId() },
        },
      });
      void reloadCart();
      if (!r.payment) {
        router.replace(`/order/success/${r.order.orderNumber}`);
        return;
      }
      const result = await pay(r.payment, { confirmMock: () => confirmMock(r.payment!) });
      if (result.status === 'paid') router.replace(`/order/success/${result.orderNumber}`);
      else {
        toast.error(result.status === 'failed' ? result.message : 'Payment not completed. Your order is saved — you can pay from My Orders within 30 minutes.');
        router.replace(`/account/orders/${r.order.orderNumber}`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
      void refreshQuote();
    } finally {
      setPlacing(false);
    }
  };

  if (status !== 'authed' || !quote) {
    return (
      <div className="container-x grid gap-8 py-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40" />
          ))}
        </div>
        <div className="skeleton h-80" />
      </div>
    );
  }

  if (!quote.lines.length) {
    return (
      <div className="container-x py-16 text-center">
        <h1 className="text-3xl">Nothing to check out</h1>
        <p className="mt-2 text-muted">Your cart is empty.</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Continue shopping
        </Link>
      </div>
    );
  }

  const selected = addresses?.find((a) => a.id === addressId);

  return (
    <div className="container-x py-4 md:py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] md:text-[28px]">Checkout</h1>
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <Lock size={14} /> Secure checkout
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:mt-5 md:gap-6 lg:grid-cols-[1fr_400px] lg:gap-8">
        <div className="space-y-5">
          <Step n={1} title="Delivery address" done={Boolean(selected) && !adding}>
            {addresses === null ? (
              <Spinner />
            ) : (
              <>
                {!adding && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {addresses.map((a) => (
                      <label key={a.id} className={`relative cursor-pointer rounded-[var(--radius-sm)] p-4 text-sm ring-1 transition ${addressId === a.id ? 'bg-marigold-soft ring-2 ring-ink' : 'ring-line hover:ring-ink'}`}>
                        <input type="radio" name="address" className="sr-only" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                        <div className="flex items-center gap-2 font-semibold">
                          {a.fullName}
                          <span className="rounded-full bg-tile px-2 py-0.5 text-[11px] font-semibold">{a.type}</span>
                        </div>
                        <p className="mt-1 text-muted">
                          {a.line1}
                          {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}
                        </p>
                        <p className="mt-1 text-muted">Phone: {a.phone}</p>
                        {addressId === a.id && <Check size={18} className="absolute right-3 top-3 text-ink" />}
                      </label>
                    ))}
                    <button onClick={() => setAdding(true)} className="flex min-h-[110px] items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-line text-sm font-semibold hover:border-ink">
                      <Plus size={16} /> Add a new address
                    </button>
                  </div>
                )}
                {adding && (
                  <AddressForm
                    initial={{ fullName: user?.name ?? '', phone: user?.phone?.replace('+91', '') ?? '', isDefault: !addresses.length }}
                    onSubmit={saveAddress}
                    onCancel={addresses.length ? () => setAdding(false) : undefined}
                    submitLabel="Deliver here"
                  />
                )}
              </>
            )}
          </Step>

          <Step n={2} title="Payment method">
            <div className="space-y-3">
              {(
                [
                  { v: 'RAZORPAY' as Method, icon: CreditCard, title: 'Pay online', body: 'UPI, cards, netbanking & wallets via Razorpay', disabled: false },
                  {
                    v: 'COD' as Method,
                    icon: Banknote,
                    title: 'Cash on Delivery',
                    body: quote.codAvailable ? `Pay when your order arrives${quote.codFee || method === 'COD' ? '' : ''}` : 'Not available for this order value',
                    disabled: !quote.codAvailable,
                  },
                ]
              ).map((m) => (
                <label key={m.v} className={`flex items-center gap-4 rounded-[var(--radius-sm)] p-4 ring-1 transition ${m.disabled ? 'cursor-not-allowed opacity-50 ring-line' : 'cursor-pointer'} ${method === m.v ? 'bg-marigold-soft ring-2 ring-ink' : 'ring-line hover:ring-ink'}`}>
                  <input type="radio" name="method" className="size-4 accent-[var(--ink)]" checked={method === m.v} disabled={m.disabled} onChange={() => setMethod(m.v)} />
                  <m.icon size={22} className="shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold">{m.title}</div>
                    <div className="text-sm text-muted">{m.body}</div>
                  </div>
                  {m.v === 'RAZORPAY' && <span className="rounded-full bg-peacock-soft px-2.5 py-1 text-xs font-semibold text-peacock">Fastest</span>}
                </label>
              ))}
              {method === 'COD' && quote.codFee > 0 && <p className="text-xs text-muted">A {inr(quote.codFee)} cash handling fee applies. Pay online to skip it.</p>}
            </div>
          </Step>

          <Step n={3} title="Review items">
            <ul className="divide-y divide-line">
              {quote.lines.map((l) => (
                <li key={l.variantId} className="flex items-center gap-3 py-3">
                  <Img src={l.image} alt="" className="size-14 rounded-[var(--radius-sm)] bg-tile object-cover" />
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="line-clamp-1 font-medium">{l.productName}</div>
                    <div className="text-muted">
                      {l.variantTitle !== 'Default' ? `${l.variantTitle} · ` : ''}Qty {l.quantity}
                    </div>
                    {l.issue && <div className="font-semibold text-danger">{l.issue}</div>}
                  </div>
                  <div className="price">{inr(l.total)}</div>
                </li>
              ))}
            </ul>
            <label className="mt-4 block">
              <span className="label">
                Delivery instructions <span className="font-normal text-muted">(optional)</span>
              </span>
              <textarea className="field" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Call before delivery, leave with security" />
            </label>
          </Step>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius)] bg-surface p-5 ring-1 ring-line">
            <CouponBox
              cart={quote}
              onApply={async (code) => {
                if (buyNow) {
                  setCoupon(code);
                  const r = await api<{ cart: Cart }>('/cart/quote', { body: { items: buyNow, couponCode: code, paymentMethod: method } }).catch(() => null);
                  if (!r?.cart.coupon?.valid) {
                    toast.error(r?.cart.coupon?.message ?? 'Invalid coupon');
                    setCoupon(null);
                    return false;
                  }
                  toast.success(r.cart.coupon.message);
                  return true;
                }
                const ok = await applyCartCoupon(code);
                await refreshQuote();
                return ok;
              }}
              onRemove={async () => {
                if (buyNow) setCoupon(null);
                else {
                  await removeCartCoupon();
                  await refreshQuote();
                }
              }}
            />

            {quote.loyaltyPointsAvailable > 0 && (
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] bg-tile p-3 text-sm">
                <Gift size={18} className="text-[#b07a00]" />
                <span className="flex-1">
                  Use reward points
                  <span className="block text-xs text-muted">
                    {quote.loyaltyPointsAvailable} available · up to {quote.maxLoyaltyPoints} usable on this order
                  </span>
                </span>
                <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={usePoints} disabled={!quote.maxLoyaltyPoints} onChange={(e) => setUsePoints(e.target.checked)} />
              </label>
            )}

            <div className="my-5 border-t border-line" />
            <SummaryRows cart={quote} />

            {selected && (
              <p className="mt-4 flex gap-2 text-xs text-muted">
                <MapPin size={14} className="mt-0.5 shrink-0" /> Delivering to {selected.fullName}, {selected.city} {selected.pincode}
              </p>
            )}
            <button onClick={placeOrder} disabled={placing || !addressId || adding || quote.hasIssues} className="btn btn-accent btn-lg mt-4 w-full">
              {placing ? <Spinner /> : method === 'COD' ? `Place order · ${inr(quote.total)}` : `Pay ${inr(quote.total)}`}
            </button>
            <p className="mt-3 text-center text-xs text-muted">Order updates will be sent on WhatsApp, SMS and email.</p>
          </div>
        </aside>
      </div>

      <Sheet open={Boolean(mockIntent)} onClose={() => (mockIntent?.resolve(false), setMockIntent(null))} title="Test payment" side="center" width="max-w-sm">
        <div className="p-5">
          <p className="text-sm text-muted">Razorpay keys aren’t configured yet, so this simulates a UPI payment of</p>
          <p className="price mt-2 text-2xl">{mockIntent && inr(mockIntent.intent.amount)}</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="btn btn-outline" onClick={() => (mockIntent?.resolve(false), setMockIntent(null))}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => (mockIntent?.resolve(true), setMockIntent(null))}>
              Pay now
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}
