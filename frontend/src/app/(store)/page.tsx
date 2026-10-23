import Link from 'next/link';
import { ChevronRight, MessageCircle, Banknote, ShieldCheck, Sprout, Truck, Zap } from 'lucide-react';
import { serverApi } from '@/lib/server-api';
import type { Banner, Category, Offer, ProductCard, StoreSettings } from '@/lib/types';
import { CROPS, NEEDS, TRUST } from '@/lib/storefront';
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

const ICONS = { shield: ShieldCheck, truck: Truck, wallet: Banknote, sprout: Sprout };

function Section({ title, subtitle, href, link = 'View all', tone, children, icon }: { title: string; subtitle?: string; href?: string; link?: string; tone?: 'gold'; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="container-x mt-3 md:mt-5">
      <div className={`rounded-[var(--radius)] border p-3 md:p-5 ${tone === 'gold' ? 'border-marigold/30 bg-marigold-soft' : 'border-line bg-surface'}`}>
        <div className="mb-3 flex items-center justify-between gap-3 md:mb-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon}
            <div className="min-w-0">
              <h2 className="text-[17px] md:text-[21px]">{title}</h2>
              {subtitle && <div className="mt-0.5 text-[12px] text-muted md:text-[13px]">{subtitle}</div>}
            </div>
          </div>
          {href && (
            <Link href={href} className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-[var(--radius-sm)] bg-ink pr-2 pl-3 text-[12px] font-semibold text-white hover:bg-ink-soft">
              {link} <ChevronRight size={14} />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const [home, s] = await Promise.all([serverApi<Home>('/cms/home'), serverApi<{ settings: StoreSettings }>('/cms/settings')]);
  if (!home) {
    return (
      <div className="container-x py-16 text-center">
        <h1 className="text-2xl">We’ll be right back</h1>
        <p className="mt-2 text-muted">The store is temporarily unavailable. Please refresh in a moment.</p>
      </div>
    );
  }
  const { banners, categories, sections, offers } = home;
  const settings = s?.settings;
  const soonestDeal = sections.deals.map((d) => d.dealEndsAt).filter(Boolean).sort()[0];
  const wa = settings?.whatsappNumber?.replace(/[^\d]/g, '');

  return (
    <>
      {/* Category strip: scrolls on phones, evenly spaced on larger screens */}
      {categories.length > 0 && (
        <section className="container-x pt-2 md:pt-4" aria-label="Shop by category">
          <div className="rounded-[var(--radius)] border border-line bg-surface px-1 py-3 md:px-3 md:py-4">
            <ul className="scrollbar-none flex gap-1 overflow-x-auto px-2 md:grid md:grid-cols-8 md:gap-2 md:overflow-visible">
              {categories.slice(0, 8).map((c) => (
                <li key={c.id} className="w-[72px] shrink-0 md:w-auto">
                  <Link href={`/shop?category=${c.slug}`} className="group flex flex-col items-center gap-1.5 text-center">
                    <span className="block size-[60px] overflow-hidden rounded-full border border-line bg-tile transition-transform group-hover:scale-105 md:size-[76px]">
                      <Img src={c.image} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="line-clamp-2 text-[11.5px] leading-tight font-medium md:text-[12.5px]">{c.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <HeroCarousel banners={banners.filter((b) => b.position === 'HERO')} />

      <section className="container-x mt-3 md:mt-5" aria-label="Why shop with us">
        <ul className="scrollbar-none flex gap-2 overflow-x-auto md:grid md:grid-cols-4 md:gap-3">
          {TRUST.map((f) => {
            const Icon = ICONS[f.icon];
            return (
              <li key={f.title} className="flex min-w-[200px] flex-1 items-center gap-2.5 rounded-[var(--radius)] border border-line bg-surface px-3 py-2.5 md:min-w-0">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-peacock-soft text-peacock">
                  <Icon size={16} />
                </span>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold">{f.title}</div>
                  <div className="text-[11.5px] text-muted">{f.body}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Section title="Shop by crop" subtitle="See what your crop needs this season">
        <ul className="grid grid-cols-4 gap-2 md:grid-cols-8 md:gap-3">
          {CROPS.map((c) => (
            <li key={c.q}>
              <Link href={`/shop?q=${c.q}`} className="group block overflow-hidden rounded-[var(--radius)] border border-line bg-tile">
                <Img src={c.image} alt="" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="block bg-surface py-1.5 text-center text-[12px] font-semibold">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {sections.deals.length > 0 && (
        <Section
          tone="gold"
          title="Deals of the day"
          subtitle={soonestDeal ? undefined : 'Limited-time prices'}
          href="/shop?deals=true"
          link="See all"
          icon={
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-marigold">
              <Zap size={16} fill="currentColor" />
            </span>
          }
        >
          {soonestDeal && (
            <div className="-mt-2 mb-3 flex items-center gap-2 text-[12px] text-muted">
              Next deal ends in <Countdown to={soonestDeal} />
            </div>
          )}
          <ProductRail items={sections.deals} />
        </Section>
      )}

      <Section title="What does your crop need?" subtitle="Pick by stage of growth">
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
          {NEEDS.map((n) => {
            const cat = categories.find((c) => c.slug === n.category);
            return (
              <li key={n.category}>
                <Link href={`/shop?category=${n.category}`} className="flex items-center gap-2.5 rounded-[var(--radius)] border border-line bg-paper p-2 hover:border-ink/40 hover:bg-surface md:p-2.5">
                  <Img src={cat?.image} alt="" className="size-12 shrink-0 rounded-[8px] object-cover md:size-14" />
                  <span className="min-w-0 leading-tight">
                    <span className="line-clamp-2 block text-[13px] font-semibold">{n.title}</span>
                    <span className="mt-0.5 line-clamp-1 block text-[11.5px] text-muted">{n.body}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      {sections.bestSellers.length > 0 && (
        <Section title="Bestsellers" subtitle="What farmers reorder most" href="/shop?sort=popular">
          <ProductRail items={sections.bestSellers} />
        </Section>
      )}

      {wa && (
        <section className="container-x mt-3 md:mt-5">
          <div className="flex flex-col gap-3 rounded-[var(--radius)] bg-ink p-4 text-white sm:flex-row sm:items-center sm:justify-between md:p-6">
            <div>
              <h2 className="text-[17px] text-white md:text-[22px]">Not sure what to use?</h2>
              <p className="mt-1 max-w-xl text-[13px] text-white/75">Tell us your crop, acreage and stage. We’ll suggest a simple nutrient plan on WhatsApp.</p>
            </div>
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent('Hi, I need help choosing a fertilizer. Crop: ')}`} target="_blank" rel="noreferrer" className="btn btn-accent shrink-0">
              <MessageCircle size={17} /> Chat with an expert
            </a>
          </div>
        </section>
      )}

      {offers.length > 0 && (
        <Section title="Offers for you" href="/offers" link="All offers">
          <div className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:px-0">
            {offers.slice(0, 3).map((o) => (
              <OfferChip key={o.code} o={o} />
            ))}
          </div>
        </Section>
      )}

      {sections.newArrivals.length > 0 && (
        <Section title="Just landed" href="/shop?newArrival=true&sort=newest">
          <ProductGrid items={sections.newArrivals.slice(0, sections.newArrivals.length > 10 ? 10 : sections.newArrivals.length - (sections.newArrivals.length % 2))} />
        </Section>
      )}

      {sections.topRated.length > 0 && (
        <Section title="Top rated by farmers" href="/shop?sort=rating">
          <ProductRail items={sections.topRated} />
        </Section>
      )}

      <RecentlyViewed title="Pick up where you left off" />
    </>
  );
}
