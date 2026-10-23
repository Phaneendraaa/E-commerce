'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { Heart, Star, Zap } from 'lucide-react';
import type { ProductCard as Card } from '@/lib/types';
import { Countdown, Img, Price } from '@/components/ui';
import { useWishlist } from '@/store/wishlist';

export function RatingPill({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-peacock px-1.5 py-px text-[11px] leading-4 font-bold text-white">
        {value.toFixed(1)} <Star size={9} fill="currentColor" strokeWidth={0} />
      </span>
      {count !== undefined && <span className="text-[11px] text-muted tabular-nums">({count})</span>}
    </span>
  );
}

export function ProductCard({ p, priority }: { p: Card; priority?: boolean }) {
  const saved = useWishlist((s) => s.ids.has(p.id));
  const toggle = useWishlist((s) => s.toggle);
  const dealLive = p.dealEndsAt && new Date(p.dealEndsAt).getTime() > Date.now();

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-line bg-surface transition-shadow hover:shadow-[0_6px_20px_rgba(15,46,29,.10)]">
      <Link href={`/product/${p.slug}`} className="relative block bg-tile" aria-label={p.name}>
        <div className="aspect-square">
          <Img src={p.images[0]} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        </div>
        {p.isNewArrival && <span className="absolute left-2 top-2 rounded-[4px] bg-ink px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">New</span>}
        {!p.inStock && <div className="absolute inset-x-0 bottom-0 bg-ink/85 py-1 text-center text-[11px] font-semibold text-white">Out of stock</div>}
        {dealLive && p.inStock && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-marigold px-2 py-1 text-[11px] font-bold text-ink">
            <Zap size={11} fill="currentColor" /> Ends in <Countdown to={p.dealEndsAt!} compact />
          </div>
        )}
      </Link>
      <button
        onClick={() => toggle(p.id, p.name)}
        aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={saved}
        className={clsx('absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-surface/95 shadow-sm transition', saved ? 'text-rose' : 'text-muted hover:text-rose')}
      >
        <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
      </button>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        {p.brandName && <div className="text-[10.5px] font-semibold tracking-wide text-muted uppercase">{p.brandName}</div>}
        <Link href={`/product/${p.slug}`} className="line-clamp-2 min-h-[2.6em] text-[13px] leading-[1.3] font-medium hover:text-ink-soft" {...(priority ? { prefetch: true } : {})}>
          {p.name}
        </Link>
        {p.ratingCount > 0 && <RatingPill value={p.ratingAvg} count={p.ratingCount} />}
        <Price price={p.price} compareAt={p.compareAtPrice} size="sm" className="mt-auto pt-0.5" />
      </div>
    </article>
  );
}

const GRID = 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5';

export function ProductGrid({ items, className, dense }: { items: Card[]; className?: string; dense?: boolean }) {
  return (
    <div className={clsx(dense ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 xl:grid-cols-4' : GRID, className)}>
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < 4} />
      ))}
    </div>
  );
}

export function ProductRail({ items }: { items: Card[] }) {
  return (
    <div className="scrollbar-none -mx-3 flex snap-x scroll-px-3 gap-2 overflow-x-auto px-3 pb-1 md:-mx-5 md:scroll-px-5 md:gap-3 md:px-5">
      {items.map((p) => (
        <div key={p.id} className="w-[43%] shrink-0 snap-start sm:w-[28%] md:w-[23%] lg:w-[18.2%]">
          <ProductCard p={p} />
        </div>
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, dense }: { count?: number; dense?: boolean }) {
  return (
    <div className={dense ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 xl:grid-cols-4' : GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface">
          <div className="skeleton aspect-square !rounded-none" />
          <div className="space-y-2 p-2.5">
            <div className="skeleton h-2.5 w-1/3" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
