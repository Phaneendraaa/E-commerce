'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { Heart, Zap } from 'lucide-react';
import type { ProductCard as Card } from '@/lib/types';
import { Countdown, Img, Price, Stars } from '@/components/ui';
import { useWishlist } from '@/store/wishlist';

export function ProductCard({ p, priority }: { p: Card; priority?: boolean }) {
  const saved = useWishlist((s) => s.ids.has(p.id));
  const toggle = useWishlist((s) => s.toggle);
  const dealLive = p.dealEndsAt && new Date(p.dealEndsAt).getTime() > Date.now();

  return (
    <article className="group relative flex flex-col">
      <Link href={`/product/${p.slug}`} className="relative block overflow-hidden rounded-[var(--radius)] bg-tile" aria-label={p.name}>
        <div className="aspect-[4/5]">
          <Img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          {p.images[1] && (
            <Img src={p.images[1]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          )}
        </div>
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {p.discountPercent >= 10 && <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-white">−{p.discountPercent}%</span>}
          {p.isNewArrival && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink">New</span>}
        </div>
        {!p.inStock && <div className="absolute inset-x-0 bottom-0 bg-ink/80 py-1.5 text-center text-xs font-semibold text-white">Out of stock</div>}
        {dealLive && p.inStock && (
          <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-center gap-1.5 rounded-full bg-marigold px-2 py-1 text-[11px] font-bold text-ink">
            <Zap size={12} fill="currentColor" /> Deal ends in <Countdown to={p.dealEndsAt!} compact />
          </div>
        )}
      </Link>
      <button
        onClick={() => toggle(p.id, p.name)}
        aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={saved}
        className={clsx('absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-surface/90 backdrop-blur transition', saved ? 'text-rose' : 'text-ink hover:text-rose')}
      >
        <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
      </button>

      <div className="mt-3 flex flex-1 flex-col px-0.5">
        {p.brandName && <div className="text-xs font-medium text-muted">{p.brandName}</div>}
        <Link href={`/product/${p.slug}`} className="mt-0.5 line-clamp-2 text-[14px] leading-snug font-medium hover:underline" {...(priority ? { prefetch: true } : {})}>
          {p.name}
        </Link>
        {p.ratingCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
            <Stars value={p.ratingAvg} size={12} />
            <span className="tabular-nums">({p.ratingCount})</span>
          </div>
        )}
        <Price price={p.price} compareAt={p.compareAtPrice} size="sm" className="mt-1.5" />
      </div>
    </article>
  );
}

export function ProductGrid({ items, className }: { items: Card[]; className?: string }) {
  return (
    <div className={clsx('grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5', className)}>
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < 4} />
      ))}
    </div>
  );
}

export function ProductRail({ items }: { items: Card[] }) {
  return (
    <div className="scrollbar-none -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:-mx-7 md:scroll-px-7 md:px-7 lg:gap-5">
      {items.map((p) => (
        <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%]">
          <ProductCard p={p} />
        </div>
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/5] !rounded-[var(--radius)]" />
          <div className="skeleton mt-3 h-3 w-1/3" />
          <div className="skeleton mt-2 h-4 w-4/5" />
          <div className="skeleton mt-2 h-5 w-1/2" />
        </div>
      ))}
    </div>
  );
}
