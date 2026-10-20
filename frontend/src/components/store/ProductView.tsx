'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Banknote, Bell, Heart, MapPin, RotateCcw, Share2, ShieldCheck, ShoppingBag, Truck, Zap } from 'lucide-react';
import type { ProductDetail, StoreSettings, Variant } from '@/lib/types';
import { api, errorMessage } from '@/lib/api';
import { date, inr } from '@/lib/format';
import { track } from '@/lib/track';
import { Countdown, Img, Price, QtyStepper, Sheet, Spinner, Stars } from '@/components/ui';
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

  return (
    <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
      {/* Gallery */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-col-reverse gap-3 md:flex-row">
          <div className="scrollbar-none flex gap-2 overflow-x-auto md:w-[76px] md:flex-col">
            {images.map((src, i) => (
              <button key={src} onClick={() => setImgIdx(i)} aria-label={`Show image ${i + 1}`} className={`shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-tile ring-offset-2 ${i === imgIdx ? 'ring-2 ring-ink' : 'ring-1 ring-transparent hover:ring-line'}`}>
                <Img src={src} alt="" className="size-16 object-cover md:size-[76px]" />
              </button>
            ))}
          </div>
          <button onClick={() => setZoom(true)} className="relative flex-1 cursor-zoom-in overflow-hidden rounded-[var(--radius-lg)] bg-tile" aria-label="Zoom image">
            <Img src={images[imgIdx]} alt={p.name} className="aspect-square w-full object-cover" />
            {p.discountPercent >= 10 && <span className="absolute left-4 top-4 rounded-full bg-rose px-3 py-1 text-sm font-bold text-white">−{p.discountPercent}%</span>}
          </button>
        </div>
      </div>

      {/* Buy box */}
      <div>
        {p.brand && (
          <a href={`/shop?brand=${p.brand.slug}`} className="text-sm font-semibold text-peacock hover:underline">
            {p.brand.name}
          </a>
        )}
        <h1 className="mt-1 text-[30px] leading-[1.05] md:text-[42px]">{p.name}</h1>
        {p.ratingCount > 0 && (
          <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm">
            <Stars value={p.ratingAvg} size={16} />
            <span className="font-semibold">{p.ratingAvg.toFixed(1)}</span>
            <span className="text-muted underline underline-offset-2">{p.ratingCount} reviews</span>
            {p.soldCount > 20 && <span className="text-muted">· {p.soldCount}+ sold</span>}
          </a>
        )}

        <div className="mt-5">
          <Price price={price} compareAt={compare} size="xl" />
          <p className="mt-1 text-xs text-muted">Inclusive of all taxes</p>
        </div>

        {dealLive && (
          <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-sm)] bg-marigold-soft px-4 py-3 text-sm">
            <Zap size={18} className="text-[#b07a00]" fill="currentColor" />
            <span className="font-semibold">Deal of the day ends in</span>
            <Countdown to={p.dealEndsAt!} />
          </div>
        )}

        {p.shortDescription && <p className="mt-5 text-[15px] text-muted">{p.shortDescription}</p>}

        {/* Options */}
        <div className="mt-6 space-y-5">
          {p.optionNames.map((name) => (
            <div key={name}>
              <div className="mb-2.5 text-sm">
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
                        className={`relative size-10 rounded-full ring-offset-2 transition ${active ? 'ring-2 ring-ink' : 'ring-1 ring-line hover:ring-ink'} ${avail ? '' : 'opacity-40'}`}
                        style={{ background: SWATCH[value] }}
                      >
                        {!avail && <span className="absolute left-1/2 top-1/2 h-[2px] w-10 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink/60" />}
                      </button>
                    );
                  }
                  return (
                    <button
                      key={value}
                      onClick={() => choose(name, value)}
                      aria-pressed={active}
                      className={`h-10 min-w-12 rounded-[var(--radius-sm)] border-[1.5px] px-3.5 text-sm font-medium transition ${active ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:border-ink'} ${avail ? '' : 'text-faint line-through'}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Stock + actions */}
        <div className="mt-6">
          {variant && variant.lowStock && <p className="mb-3 text-sm font-semibold text-rose">Hurry — only {variant.stock} left in stock</p>}
          {variant && !variant.inStock && <p className="mb-3 text-sm font-semibold text-danger">This option is currently out of stock</p>}
          {canBuy ? (
            <div className="flex flex-wrap items-center gap-3">
              <QtyStepper value={qty} onChange={setQty} max={maxQty} />
              <button onClick={addToCart} disabled={pending === variant?.id} className="btn btn-primary btn-lg flex-1">
                {pending === variant?.id ? <Spinner /> : <ShoppingBag size={18} />} Add to cart
              </button>
              <button onClick={buyNow} className="btn btn-accent btn-lg flex-1">
                Buy now
              </button>
            </div>
          ) : (
            <button onClick={() => setNotifyOpen(true)} disabled={!variant} className="btn btn-outline btn-lg w-full">
              <Bell size={18} /> Notify me when it’s back
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <button onClick={() => toggleWish(p.id, p.name)} className={`btn btn-ghost btn-sm ${saved ? 'text-rose' : ''}`} aria-pressed={saved}>
              <Heart size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save for later'}
            </button>
            <button onClick={share} className="btn btn-ghost btn-sm">
              <Share2 size={16} /> Share
            </button>
          </div>
        </div>

        <DeliveryCheck settings={settings} />

        <ul className="mt-6 grid grid-cols-3 gap-3 text-center text-xs">
          {[
            { icon: RotateCcw, label: `${settings?.returnWindowDays ?? 7}-day easy returns` },
            { icon: Banknote, label: settings?.codEnabled ? 'Cash on Delivery' : 'Prepaid only' },
            { icon: ShieldCheck, label: 'Secure checkout' },
          ].map((b) => (
            <li key={b.label} className="rounded-[var(--radius-sm)] bg-surface px-2 py-3 ring-1 ring-line">
              <b.icon size={20} className="mx-auto mb-1.5 text-peacock" />
              {b.label}
            </li>
          ))}
        </ul>

        {/* Details */}
        <div className="mt-8 divide-y divide-line border-y border-line">
          {p.description && (
            <details open className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                Description <span className="text-xl leading-none transition group-open:rotate-45">+</span>
              </summary>
              <div className="prose-store mt-2 text-[15px]">
                <ReactMarkdown>{p.description}</ReactMarkdown>
              </div>
            </details>
          )}
          {p.specs.length > 0 && (
            <details open className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                Specifications <span className="text-xl leading-none transition group-open:rotate-45">+</span>
              </summary>
              <dl className="mt-3 grid grid-cols-[minmax(0,40%)_1fr] gap-x-4 gap-y-2.5 text-sm">
                {p.specs.map((s) => (
                  <div key={s.label} className="contents">
                    <dt className="text-muted">{s.label}</dt>
                    <dd className="font-medium">{s.value}</dd>
                  </div>
                ))}
                {variant && (
                  <div className="contents">
                    <dt className="text-muted">SKU</dt>
                    <dd className="font-medium">{variant.sku}</dd>
                  </div>
                )}
              </dl>
            </details>
          )}
        </div>
      </div>

      {/* Sticky mobile bar */}
      {canBuy && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">
            <div className="price text-lg">{inr(price)}</div>
            {variant?.title !== 'Default' && <div className="truncate text-xs text-muted">{variant?.title}</div>}
          </div>
          <button onClick={addToCart} className="btn btn-primary">
            Add to cart
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

function DeliveryCheck({ settings }: { settings: StoreSettings | null }) {
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
    <div className="mt-7 rounded-[var(--radius)] bg-surface p-4 ring-1 ring-line">
      <div className="flex items-center gap-2 text-sm font-semibold">
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
          <p className="text-muted">{res.codAvailable ? 'Cash on Delivery available' : 'Prepaid orders only'} · Free delivery over {inr(settings?.freeShippingThreshold ?? 49900)}</p>
        </div>
      )}
    </div>
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
