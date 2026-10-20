import Link from 'next/link';
import { Mail, MapPin, Phone } from 'lucide-react';
import type { Category, StoreSettings } from '@/lib/types';
import { inr } from '@/lib/format';
import { Newsletter } from './Newsletter';

const social: Record<string, string> = {
  instagram: 'M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 4.6a5.2 5.2 0 100 10.4 5.2 5.2 0 000-10.4zm0 8.6a3.4 3.4 0 110-6.8 3.4 3.4 0 010 6.8zm5.4-9.9a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z',
  facebook: 'M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.6c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4z',
  twitter: 'M17.7 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.7 3h6.4l4.4 5.9L17.7 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11 14.5z',
  youtube: 'M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.3-1C16.6 3.6 12 3.6 12 3.6s-4.6 0-7.8.3c-.4.1-1.4.1-2.3 1-.7.7-.9 2.3-.9 2.3S.7 9.1.7 11v1.8c0 1.9.3 3.8.3 3.8s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.2 7.6.2s4.6 0 7.8-.3c.4-.1 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.3-1.9.3-3.8V11c0-1.9-.3-3.8-.3-3.8zM9.7 14.9V8.3l6.1 3.3-6.1 3.3z',
};

export function Footer({ settings, categories }: { settings: StoreSettings; categories: Category[] }) {
  return (
    <footer className="mt-24 bg-ink text-white/80">
      <div className="container-x grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="font-display text-3xl font-extrabold text-white">{settings.storeName}</div>
          <p className="mt-3 max-w-xs text-sm">{settings.tagline}</p>
          <div className="mt-6 space-y-2.5 text-sm">
            <a href={`mailto:${settings.supportEmail}`} className="flex items-center gap-2.5 hover:text-white">
              <Mail size={15} /> {settings.supportEmail}
            </a>
            <a href={`tel:${settings.supportPhone.replace(/\s/g, '')}`} className="flex items-center gap-2.5 hover:text-white">
              <Phone size={15} /> {settings.supportPhone}
            </a>
            <div className="flex items-center gap-2.5">
              <MapPin size={15} /> {settings.address}
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            {Object.entries(settings.social ?? {})
              .filter(([k, v]) => v && social[k])
              .map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noreferrer" aria-label={k} className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-marigold hover:text-ink">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                    <path d={social[k]} />
                  </svg>
                </a>
              ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <h4 className="font-sans text-sm font-semibold text-white">Shop</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}>
                <Link href={`/shop?category=${c.slug}`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/shop?deals=true" className="hover:text-white">
                Today’s deals
              </Link>
            </li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <h4 className="font-sans text-sm font-semibold text-white">Help</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/account/orders" className="hover:text-white">Track your order</Link></li>
            <li><Link href="/pages/shipping-policy" className="hover:text-white">Shipping</Link></li>
            <li><Link href="/pages/returns-policy" className="hover:text-white">Returns & refunds</Link></li>
            <li><Link href="/pages/faq" className="hover:text-white">FAQs</Link></li>
            <li><Link href="/offers" className="hover:text-white">Offers</Link></li>
          </ul>
        </div>
        <div className="md:col-span-4">
          <h4 className="font-sans text-sm font-semibold text-white">Get first dibs on deals</h4>
          <p className="mt-2 text-sm">Early access to sales and new drops. No spam, unsubscribe anytime.</p>
          <Newsletter />
          <p className="mt-6 text-xs text-white/60">
            Free delivery over {inr(settings.freeShippingThreshold)} · {settings.codEnabled ? 'Cash on Delivery available · ' : ''}
            {settings.returnWindowDays}-day returns
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-3 py-5 text-xs text-white/60 md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {settings.storeName}. All rights reserved.
          </span>
          <div className="flex gap-5">
            <Link href="/pages/about" className="hover:text-white">About</Link>
            <Link href="/pages/privacy-policy" className="hover:text-white">Privacy</Link>
            <Link href="/pages/terms" className="hover:text-white">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
