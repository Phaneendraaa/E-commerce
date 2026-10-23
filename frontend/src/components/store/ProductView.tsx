'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Bell, Heart, MapPin, RotateCcw, Share2, ShieldCheck, ShoppingCart, Sprout, Truck, Zap } from 'lucide-react';
import type { ProductDetail, StoreSettings, Variant } from '@/lib/types';
import { api, errorMessage } from '@/lib/api';
import { date, inr } from '@/lib/format';
import { track } from '@/lib/track';
import { Countdown, Img, Price, QtyStepper, Sheet, Spinner } from '@/components/ui';
import { RatingPill } from './ProductCard';
import { useCart } from '@/store/cart';
import { useWishlist } from '@/store/wishlist';
import { useAuth } from '@/store/auth';
import { rememberProduct } from './RecentlyViewed';
import ReactMarkdown from 'react-markdown';

const SWATCH: Record<string, string> = {
  Black: '#1f2937', White: '#f1f5f9', Navy: '#1e3a8a', Red: '#dc2626', Olive: '#4d7c0f', Beige: '#d6c4a8', Pink: '#ec4899', Blue: '#2563eb',
  Grey: '#9ca3af', Green: '#16a34a', Silver: '#cbd5e1', Gold: '#d4a017', Teal: '#0d9488', Purple: '#7c3aed', Orange: '#ea580c', Brown: '#92400e',
};

function pickInitial(p: ProductDetail): Record<string, string> {
  const v = p.variants.find((x) => x.inStock) ?? p.variants[0];
  return v ? { ...v.options } : {};
}

export function ProductView({ product: p, settings }: { product: ProductDetail; settings: StoreSettings | null }) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<string, string>>(() => pickInitial(p));
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const { add, pending } = useCart();
  const saved = useWishlist((s) => s.ids.has(p.id));
  const toggleWish = useWishlist((s) => s.toggle);

  const variant: Variant | undefined = useMemo(() => p.variants.find((v) => p.optionNames.every((n) => v.options[n] === sel[n])) ?? (p.optionNames.length ? undefined : p.variants[0]), [p, sel]);

  // Gallery: show the selected colour's image first
  const images = useMemo(() => {
    const first = variant?.image;
    return first ? [first, ...p.images.filter((i) => i !== first)] : p.images;
  }, [variant, p.images]);
  useEffect(() => setImgIdx(0), [variant?.image]);

  useEffect(() => {
    track({ type: 'PRODUCT_VIEW', productId: p.id, value: p.price });
    rememberProduct(p.id);
  }, [p.id, p.price]);

  /** Is there any purchasable variant with this option value (given the other current selections)? */
  const valueAvailable = (name: string, value: string) =>
    p.variants.some((v) => v.options[name] === value && v.inStock && p.optionNames.every((n) => n === name || !sel[n] || v.options[n] === sel[n]));

  const choose = (name: string, value: string) => {
    const next = { ...sel, [name]: value };
    // If that combination doesn't exist, jump to the first variant that has this value
    if (!p.variants.some((v) => p.optionNames.every((n) => v.options[n] === next[n]))) {
      const fallback = p.variants.find((v) => v.options[name] === value && v.inStock) ?? p.variants.find((v) => v.options[name] === value);
      if (fallback) return setSel({ ...fallback.options });
    }
    setSel(next);
  };

  const price = variant?.price ?? p.price;
  const compare = variant?.compareAtPrice ?? p.compareAtPrice;
  const canBuy = Boolean(variant?.inStock);
  const maxQty = Math.min(10, variant?.stock ?? 0);
  const dealLive = p.dealEndsAt && new Date(p.dealEndsAt).getTime() > Date.now();

  const addToCart = async () => {
    if (!variant) return toast.error(`Please choose ${p.optionNames.filter((n) => !sel[n]).join(' and ') || 'an option'}`);
    await add(variant.id, qty, { productId: p.id, price, name: p.name });
  };

  const buyNow = () => {
    if (!variant) return;
    router.push(`/checkout?buy=${variant.id}:${qty}`);
  };

  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      /* cancelled */
    }
  };

  const card = '-mx-3 border-y border-line bg-surface p-3 md:mx-0 md:rounded-[var(--radius)] md:border md:p-5';
  const single = p.optionNames.length === 1;
  const priceOf = (name: string, value: string) => (single ? p.variants.find((v) => v.options[name] === value)?.price : undefined);
  const glance = p.specs.filter((x) => /^(nutrient|best for|typical dose|dose)/i.test(x.label)).slice(0, 3);

  return (
    <div className="mt-2 grid gap-2 md:mt-3 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-5">
      {/* Gallery */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <div className="-mx-3 border-y border-line bg-surface p-0 md:mx-0 md:rounded-[var(--radius)] md:border md:p-3">
          <div className="flex flex-col-reverse gap-2 md:flex-row md:gap-3">
            <div className="scrollbar-none flex gap-2 overflow-x-auto px-3 pb-3 md:w-[68px] md:flex-col md:p-0">
              {images.map((src, i) => (
                <button key={src} onClick={() => setImgIdx(i)} aria-label={`Show image ${i + 1}`} className={`shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-tile ${i === imgIdx ? 'ring-2 ring-ink' : 'ring-1 ring-line hover:ring-ink/50'}`}>
                  <Img src={src} alt="" className="size-14 object-cover md:size-[68px]" />
                </button>
              ))}
            </div>
            <div className="relative flex-1 overflow-hidden bg-tile md:rounded-[var(--radius-sm)]">
              <button onClick={() => setZoom(true)} className="block w-full cursor-zoom-in" aria-label="Zoom image">
                <Img src={images[imgIdx]} alt={p.name} className="aspect-square w-full object-cover" />
              </button>
              {p.discountPercent >= 10 && <span className="absolute left-0 top-3 rounded-r-[6px] bg-peacock px-2.5 py-1 text-[12px] font-bold text-white">{p.discountPercent}% OFF</span>}
              <div className="absolute right-3 top-3 flex flex-col gap-2">
                <button onClick={() => toggleWish(p.id, p.name)} aria-pressed={saved} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'} className={`grid size-9 place-items-center rounded-full bg-surface shadow ${saved ? 'text-rose' : 'text-muted hover:text-rose'}`}>
                  <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
                </button>
                <button onClick={share} aria-label="Share" className="grid size-9 place-items-center rounded-full bg-surface text-muted shadow hover:text-ink">
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Buy box */}
      <div className="flex flex-col gap-2">
        <section className={card}>
          {p.brand && (
            <a href={`/shop?brand=${p.brand.slug}`} className="text-[11.5px] font-bold tracking-wider text-peacock uppercase hover:underline">
              {p.brand.name}
            </a>
          )}
          <h1 className="mt-0.5 text-[19px] leading-[1.25] md:text-[26px]">{p.name}</h1>
          {p.ratingCount > 0 && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-[13px]">
              <RatingPill value={p.ratingAvg} />
              <span className="text-muted">{p.ratingCount} ratings</span>
              {p.soldCount > 20 && <span className="text-muted">· {p.soldCount}+ sold</span>}
            </a>
          )}

          <div className="mt-3">
            <Price price={price} compareAt={compare} size="xl" />
            <p className="mt-0.5 text-[11.5px] text-muted">Inclusive of all taxes</p>
          </div>

          {dealLive && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-marigold-soft px-3 py-2 text-[13px]">
              <Zap size={16} className="text-[#9a6a00]" fill="currentColor" />
              <span className="font-semibold">Deal ends in</span>
              <Countdown to={p.dealEndsAt!} />
            </div>
          )}

          {p.shortDescription && <p className="mt-3 text-[13.5px] text-muted">{p.shortDescription}</p>}

          {/* Options */}
          {p.optionNames.length > 0 && (
            <div className="mt-4 space-y-4 border-t border-line pt-4">
              {p.optionNames.map((name) => (
                <div key={name}>
                  <div className="mb-2 text-[13px]">
                    <span className="font-semibold">{name}:</span> <span className="text-muted">{sel[name] ?? 'Choose'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.optionValues[name].map((value) => {
                      const active = sel[name] === value;
                      const avail = valueAvailable(name, value);
                      if (name === 'Color' && SWATCH[value]) {
                        return (
                          <button
                            key={value}
                            onClick={() => choose(name, value)}
                            title={avail ? value : `${value} — out of stock`}
                            aria-label={value}
                            aria-pressed={active}
                            className={`relative size-9 rounded-full ring-offset-2 transition ${active ? 'ring-2 ring-ink' : 'ring-1 ring-line hover:ring-ink'} ${avail ? '' : 'opacity-40'}`}
                            style={{ background: SWATCH[value] }}
                          />
                        );
                      }
                      const pr = priceOf(name, value);
                      return (
                        <button
                          key={value}
                          onClick={() => choose(name, value)}
                          aria-pressed={active}
                          className={`min-w-[84px] rounded-[var(--radius-sm)] border px-3 py-1.5 text-left transition ${active ? 'border-ink bg-tile ring-1 ring-ink' : 'border-line bg-surface hover:border-ink/60'} ${avail ? '' : 'opacity-50'}`}
                        >
                          <span className={`block text-[13px] font-semibold ${avail ? '' : 'line-through'}`}>{value}</span>
                          {pr !== undefined && <span className="block text-[11.5px] text-muted">{avail ? inr(pr) : 'Sold out'}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stock + actions */}
          <div className="mt-4 border-t border-line pt-4">
            {variant && variant.lowStock && <p className="mb-2 text-[13px] font-semibold text-rose">Hurry, only {variant.stock} left in stock</p>}
            {variant && !variant.inStock && <p className="mb-2 text-[13px] font-semibold text-danger">This option is currently out of stock</p>}
            {canBuy ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-semibold">Qty</span>
                  <QtyStepper value={qty} onChange={setQty} max={maxQty} />
                </div>
                <div className="hidden flex-1 gap-2 lg:flex">
                  <button onClick={addToCart} disabled={pending === variant?.id} className="btn btn-primary btn-lg flex-1">
                    {pending === variant?.id ? <Spinner /> : <ShoppingCart size={17} />} Add to cart
                  </button>
                  <button onClick={buyNow} className="btn btn-accent btn-lg flex-1">
                    Buy now
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setNotifyOpen(true)} disabled={!variant} className="btn btn-outline btn-lg w-full">
                <Bell size={17} /> Notify me when it’s back
              </button>
            )}
          </div>
        </section>

        {glance.length > 0 && (
          <section className={`${card} !bg-peacock-soft/60`}>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold">
              <Sprout size={16} className="text-peacock" /> At a glance
            </h2>
            <dl className="mt-2.5 space-y-2 text-[13px]">
              {glance.map((g) => (
                <div key={g.label} className="grid grid-cols-[96px_1fr] gap-3">
                  <dt className="text-muted">{g.label}</dt>
                  <dd className="font-semibold">{g.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <DeliveryCheck settings={settings} cardClass={card} />

        <ul className={`${card} grid grid-cols-3 gap-2 !py-3 text-center text-[11.5px] font-medium`}>
          {[
            { icon: ShieldCheck, label: 'Genuine, sealed pack' },
            { icon: Banknote, label: settings?.codEnabled ? 'Cash on Delivery' : 'Prepaid only' },
            { icon: RotateCcw, label: `${settings?.returnWindowDays ?? 7}-day returns` },
          ].map((b) => (
            <li key={b.label}>
              <b.icon size={20} className="mx-auto mb-1 text-peacock" />
              {b.label}
            </li>
          ))}
        </ul>

        {/* Details */}
        <section className={`${card} !py-0 divide-y divide-line`}>
          {p.description && (
            <details open className="group py-3.5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold">
                Description <span className="text-xl leading-none transition group-open:rotate-45">+</span>
              </summary>
              <div className="prose-store mt-2 text-[13.5px]">
                <ReactMarkdown>{p.description}</ReactMarkdown>
              </div>
            </details>
          )}
          {p.specs.length > 0 && (
            <details open className="group py-3.5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-semibold">
                Specifications <span className="text-xl leading-none transition group-open:rotate-45">+</span>
              </summary>
              <dl className="mt-2.5 overflow-hidden rounded-[var(--radius-sm)] border border-line text-[13px]">
                {[...p.specs, ...(variant ? [{ label: 'SKU', value: variant.sku }] : [])].map((x, i) => (
                  <div key={x.label} className={`grid grid-cols-[minmax(0,38%)_1fr] gap-3 px-3 py-2 ${i % 2 ? 'bg-surface' : 'bg-paper'}`}>
                    <dt className="text-muted">{x.label}</dt>
                    <dd className="font-medium">{x.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </section>
      </div>

      {/* Sticky mobile bar (replaces the bottom tab bar on this page) */}
      {canBuy && (
        <div className="product-bar fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-line bg-surface p-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(15,46,29,.08)] lg:hidden">
          <button onClick={addToCart} disabled={pending === variant?.id} className="btn btn-outline !h-11 !text-[14px]">
            {pending === variant?.id ? <Spinner /> : <ShoppingCart size={16} />} Add to cart
          </button>
          <button onClick={buyNow} className="btn btn-accent !h-11 !text-[14px]">
            Buy now · {inr(price * qty)}
          </button>
        </div>
      )}

      <Sheet open={zoom} onClose={() => setZoom(false)} title={p.name} side="center" width="max-w-3xl">
        <Img src={images[imgIdx]} alt={p.name} className="w-full bg-tile object-contain" />
      </Sheet>
      <NotifyMe open={notifyOpen} onClose={() => setNotifyOpen(false)} variantId={variant?.id} />
    </div>
  );
}

function DeliveryCheck({ settings, cardClass }: { settings: StoreSettings | null; cardClass: string }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ days: number; eta: string; codAvailable: boolean } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sn_pincode');
      if (saved) setPin(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return setErr('Enter a valid 6-digit pincode');
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ days: number; eta: string; codAvailable: boolean }>('/cms/delivery-estimate', { query: { pincode: pin } });
      setRes(r);
      localStorage.setItem('sn_pincode', pin);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cardClass}>
      <div className="flex items-center gap-2 text-[14px] font-semibold">
        <Truck size={17} className="text-peacock" /> Delivery
      </div>
      <form onSubmit={check} className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter pincode" inputMode="numeric" className="field !h-10 pl-9 text-sm" aria-label="Pincode" />
        </div>
        <button disabled={busy} className="btn btn-outline btn-sm !h-10">
          {busy ? <Spinner size={15} /> : 'Check'}
        </button>
      </form>
      {err && <p className="mt-2 text-xs font-medium text-danger">{err}</p>}
      {res && (
        <div className="mt-3 space-y-1 text-sm">
          <p>
            Get it by <b>{date(res.eta, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
          </p>
          <p className="text-muted">{res.codAvailable ? 'Cash on Delivery available' : 'Prepaid orders only'} · Free delivery over {inr(settings?.freeShippingThreshold ?? 99900)}</p>
        </div>
      )}
    </section>
  );
}

function NotifyMe({ open, onClose, variantId }: { open: boolean; onClose: () => void; variantId?: string }) {
  const user = useAuth((s) => s.user);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantId) return;
    setBusy(true);
    try {
      const r = await api<{ message: string }>(`/variants/${variantId}/notify-me`, { body: user ? {} : { email } });
      toast.success(r.message);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Get notified" side="center" width="max-w-sm">
      <form onSubmit={submit} className="p-5">
        <p className="text-sm text-muted">We’ll message you as soon as this is back in stock.</p>
        {!user && <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="field mt-4" aria-label="Email" />}
        <button disabled={busy} className="btn btn-primary mt-4 w-full">
          {busy ? <Spinner /> : 'Notify me'}
        </button>
      </form>
    </Sheet>
  );
}
