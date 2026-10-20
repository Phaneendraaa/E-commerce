import Link from 'next/link';
import { Banknote, RotateCcw, ShieldCheck, Truck, Zap } from 'lucide-react';
import { serverApi } from '@/lib/server-api';
import type { Banner, Category, Offer, ProductCard } from '@/lib/types';
import { HeroCarousel } from '@/components/store/HeroCarousel';
import { ProductGrid, ProductRail } from '@/components/store/ProductCard';
import { OfferChip } from '@/components/store/OfferChip';
import { RecentlyViewed } from '@/components/store/RecentlyViewed';
import { Countdown, Img } from '@/components/ui';

interface Home {
  banners: Banner[];
  categories: Category[];
  sections: Record<'featured' | 'newArrivals' | 'bestSellers' | 'deals' | 'topRated', ProductCard[]>;
  offers: Offer[];
}

export const revalidate = 60;

function SectionHead({ title, href, link = 'View all' }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="text-[28px] md:text-[38px]">{title}</h2>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold underline decoration-marigold decoration-2 underline-offset-4 hover:decoration-ink">
          {link}
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const home = await serverApi<Home>('/cms/home');
  if (!home) {
    return (
      <div className="container-x py-24 text-center">
        <h1 className="text-3xl">We’ll be right back</h1>
        <p className="mt-2 text-muted">The store is temporarily unavailable. Please refresh in a moment.</p>
      </div>
    );
  }
  const { banners, categories, sections, offers } = home;
  const soonestDeal = sections.deals.map((d) => d.dealEndsAt).filter(Boolean).sort()[0];

  return (
    <>
      <HeroCarousel banners={banners.filter((b) => b.position === 'HERO')} />

      <section className="container-x mt-5">
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] bg-line ring-1 ring-line md:grid-cols-4">
          {[
            { icon: Truck, title: 'Fast, free delivery', body: 'On orders above ₹499' },
            { icon: Banknote, title: 'Cash on Delivery', body: 'Pay when it arrives' },
            { icon: RotateCcw, title: 'Easy 7-day returns', body: 'Free doorstep pickup' },
            { icon: ShieldCheck, title: 'Secure payments', body: 'UPI, cards & netbanking' },
          ].map((f) => (
            <li key={f.title} className="flex items-center gap-3 bg-surface px-4 py-4">
              <f.icon size={22} className="shrink-0 text-peacock" />
              <div>
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="text-xs text-muted">{f.body}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {categories.length > 0 && (
        <section className="container-x mt-16">
          <SectionHead title="Shop by category" href="/shop" link="Browse everything" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {categories.slice(0, 5).map((c, i) => (
              <Link key={c.id} href={`/shop?category=${c.slug}`} className={`group relative overflow-hidden rounded-[var(--radius)] bg-tile ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
                <Img src={c.image} alt="" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4 pt-10">
                  <div className="font-display text-xl font-bold text-white md:text-2xl">{c.name}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {sections.deals.length > 0 && (
        <section className="container-x mt-16">
          <div className="rounded-[var(--radius-lg)] bg-marigold-soft p-5 md:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-marigold">
                  <Zap size={20} fill="currentColor" />
                </span>
                <div>
                  <h2 className="text-[28px] md:text-[38px]">Deals of the day</h2>
                  {soonestDeal && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                      Next deal ends in <Countdown to={soonestDeal} />
                    </div>
                  )}
                </div>
              </div>
              <Link href="/shop?deals=true" className="btn btn-primary btn-sm">
                See all deals
              </Link>
            </div>
            <ProductRail items={sections.deals} />
          </div>
        </section>
      )}

      {sections.bestSellers.length > 0 && (
        <section className="container-x mt-16">
          <SectionHead title="Bestsellers" href="/shop?sort=popular" />
          <ProductRail items={sections.bestSellers} />
        </section>
      )}

      {offers.length > 0 && (
        <section className="container-x mt-16">
          <SectionHead title="Offers for you" href="/offers" link="All offers" />
          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0">
            {offers.slice(0, 3).map((o) => (
              <OfferChip key={o.code} o={o} />
            ))}
          </div>
        </section>
      )}

      {sections.newArrivals.length > 0 && (
        <section className="container-x mt-16">
          <SectionHead title="Just landed" href="/shop?newArrival=true&sort=newest" />
          <ProductGrid items={sections.newArrivals.slice(0, 8)} />
        </section>
      )}

      {sections.topRated.length > 0 && (
        <section className="container-x mt-16">
          <SectionHead title="Loved by customers" href="/shop?sort=rating" />
          <ProductRail items={sections.topRated} />
        </section>
      )}

      <RecentlyViewed title="Pick up where you left off" />
    </>
  );
}
