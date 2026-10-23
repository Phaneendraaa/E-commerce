import Link from 'next/link';
import { Mail, MapPin, MessageCircle, Phone, ShieldCheck, Truck, Wallet, Sprout } from 'lucide-react';
import type { Category, StoreSettings } from '@/lib/types';
import { inr } from '@/lib/format';
import { Logo } from './Header';

const social: Record<string, string> = {
  instagram: 'M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 4.6a5.2 5.2 0 100 10.4 5.2 5.2 0 000-10.4zm0 8.6a3.4 3.4 0 110-6.8 3.4 3.4 0 010 6.8zm5.4-9.9a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z',
  facebook: 'M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.6c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4z',
  twitter: 'M17.7 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.7 3h6.4l4.4 5.9L17.7 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11 14.5z',
  youtube: 'M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.3-1C16.6 3.6 12 3.6 12 3.6s-4.6 0-7.8.3c-.4.1-1.4.1-2.3 1-.7.7-.9 2.3-.9 2.3S.7 9.1.7 11v1.8c0 1.9.3 3.8.3 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.2 7.6.2s4.6 0 7.8-.3c.4-.1 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.3-1.9.3-3.8V11c0-1.9-.3-3.8-.3-3.8zM9.7 14.9V8.3l6.1 3.3-6.1 3.3z',
};

export function Footer({ settings, categories }: { settings: StoreSettings; categories: Category[] }) {
  const wa = settings.whatsappNumber?.replace(/[^\d]/g, '');
  const link = 'text-[13px] text-white/70 hover:text-white';
  const head = 'text-[12px] font-bold tracking-wider text-white uppercase';
  return (
    <footer className="mt-10 bg-ink text-white/80 md:mt-14">
      <div className="border-b border-white/10">
        <ul className="container-x grid grid-cols-2 gap-x-4 gap-y-4 py-5 md:grid-cols-4">
          {[
            { icon: ShieldCheck, t: 'Genuine, sealed stock', b: 'Batch-numbered packs' },
            { icon: Truck, t: 'Farm-gate delivery', b: `Free over ${inr(settings.freeShippingThreshold)}` },
            { icon: Wallet, t: settings.codEnabled ? 'Cash on Delivery' : 'Secure payments', b: 'UPI, cards, netbanking' },
            { icon: Sprout, t: 'Crop guidance', b: 'Dosage notes on every pack' },
          ].map((f) => (
            <li key={f.t} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-marigold">
                <f.icon size={17} />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="text-[13px] font-semibold text-white">{f.t}</div>
                <div className="text-[12px] text-white/60">{f.b}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="container-x grid grid-cols-2 gap-x-6 gap-y-8 py-8 md:grid-cols-12 md:py-10">
        <div className="col-span-2 md:col-span-4">
          <Logo name={settings.storeName} className="text-white" />
          <p className="mt-3 max-w-xs text-[13px] text-white/70">{settings.tagline}</p>
          {wa && (
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi, I need help choosing a fertilizer.')}`} target="_blank" rel="noreferrer" className="btn btn-accent btn-sm mt-4 !h-9">
              <MessageCircle size={16} /> Ask an expert on WhatsApp
            </a>
          )}
          <div className="mt-5 space-y-2 text-[13px]">
            <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2.5 hover:text-white">
              <Mail size={14} /> {settings.supportEmail}
            </a>
            {settings.supportPhone && (
              <a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 hover:text-white">
                <Phone size={14} /> {settings.supportPhone}
              </a>
            )}
            {settings.address && (
              <div className="flex items-center gap-2.5">
                <MapPin size={14} /> {settings.address}
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            {Object.entries(settings.social ?? {})
              .filter(([k, v]) => v && social[k])
              .map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noreferrer" aria-label={k} className="grid size-8 place-items-center rounded-full bg-white/10 hover:bg-marigold hover:text-ink">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden>
                    <path d={social[k]} />
                  </svg>
                </a>
              ))}
          </div>
        </div>

        <div className="md:col-span-4">
          <h4 className={head}>Shop</h4>
          <ul className="mt-3 space-y-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/shop?category=${c.slug}`} className={link}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-4">
          <h4 className={head}>Help</h4>
          <ul className="mt-3 space-y-2">
            <li><Link href="/account/orders" className={link}>Track your order</Link></li>
            <li><Link href="/pages/shipping-policy" className={link}>Shipping</Link></li>
            <li><Link href="/pages/returns-policy" className={link}>Returns & refunds</Link></li>
            <li><Link href="/pages/faq" className={link}>FAQs</Link></li>
            <li><Link href="/offers" className={link}>Offers</Link></li>
            <li><Link href="/pages/about" className={link}>About us</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-4 text-[12px] text-white/55 md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {settings.storeName}. Dosages shown are indicative; follow your soil test report.
          </span>
          <div className="flex gap-5">
            <Link href="/pages/privacy-policy" className="hover:text-white">Privacy</Link>
            <Link href="/pages/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
