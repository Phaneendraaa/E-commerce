'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/lib/types';

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef<number | null>(null);
  const n = banners.length;

  useEffect(() => {
    if (n < 2 || paused) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [n, paused]);

  if (!n) return null;
  const b = banners[i];
  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <section
      className="container-x pt-2 md:pt-4"
      aria-roledescription="carousel"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <div className="relative overflow-hidden rounded-[var(--radius)] bg-ink">
        {banners.map((x, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={x.id}
            src={x.image}
            alt=""
            aria-hidden
            className={`absolute inset-0 h-full w-full object-cover object-[72%_center] transition-opacity duration-700 sm:object-center ${k === i ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="relative flex min-h-[190px] items-center px-4 py-5 sm:min-h-[260px] sm:px-8 md:min-h-[340px] md:px-14">
          <div key={b.id} className="animate-rise max-w-[58%] sm:max-w-[420px] md:max-w-[520px]">
            <h1 className="text-[22px] leading-[1.08] font-semibold text-white sm:text-[32px] md:text-[46px]">{b.title}</h1>
            {b.subtitle && <p className="mt-1.5 line-clamp-3 text-[12px] leading-snug text-white/80 sm:mt-3 sm:text-[15px] md:text-[17px]">{b.subtitle}</p>}
            {b.link && (
              <Link href={b.link} className="btn btn-accent mt-3 !h-9 !px-4 !text-[13px] sm:mt-5 md:!h-11 md:!px-6 md:!text-[15px]">
                {b.ctaText || 'Shop now'}
              </Link>
            )}
          </div>
        </div>
        {n > 1 && (
          <>
            <div className="absolute bottom-2.5 left-4 flex gap-1.5 sm:left-8 md:bottom-4 md:left-14">
              {banners.map((x, k) => (
                <button key={x.id} onClick={() => setI(k)} aria-label={`Go to slide ${k + 1}`} aria-current={k === i} className={`h-1 rounded-full transition-all ${k === i ? 'w-6 bg-marigold' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
            <button onClick={() => go(-1)} className="absolute top-1/2 left-3 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white md:grid" aria-label="Previous slide">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => go(1)} className="absolute top-1/2 right-3 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white md:grid" aria-label="Next slide">
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
