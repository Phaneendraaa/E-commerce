'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/lib/types';

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
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

  return (
    <section className="container-x pt-5" aria-roledescription="carousel" aria-label="Featured collections" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-ink">
        {banners.map((x, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={x.id}
            src={x.image}
            alt=""
            aria-hidden
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${k === i ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="relative flex min-h-[380px] flex-col justify-end p-7 sm:min-h-[440px] md:min-h-[480px] md:justify-center md:p-14">
          <div key={b.id} className="max-w-[560px] animate-rise">
            <h1 className="text-[44px] leading-[0.95] font-extrabold text-white sm:text-6xl md:text-[78px]" style={{ letterSpacing: '-0.035em' }}>
              {b.title}
            </h1>
            {b.subtitle && <p className="mt-4 max-w-md text-[17px] text-white/80">{b.subtitle}</p>}
            {b.link && (
              <Link href={b.link} className="btn btn-accent btn-lg mt-7">
                {b.ctaText || 'Shop now'}
              </Link>
            )}
          </div>
        </div>
        {n > 1 && (
          <div className="absolute bottom-5 right-5 flex items-center gap-2 md:bottom-8 md:right-8">
            <button onClick={() => setI((i - 1 + n) % n)} className="grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25" aria-label="Previous slide">
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-1.5 px-1">
              {banners.map((x, k) => (
                <button key={x.id} onClick={() => setI(k)} aria-label={`Go to slide ${k + 1}`} aria-current={k === i} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-7 bg-marigold' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
            <button onClick={() => setI((i + 1) % n)} className="grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25" aria-label="Next slide">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
