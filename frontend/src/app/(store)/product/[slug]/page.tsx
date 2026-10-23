import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { serverApi } from '@/lib/server-api';
import type { ProductCard, ProductDetail, StoreSettings } from '@/lib/types';
import { ProductView } from '@/components/store/ProductView';
import { ProductReviews } from '@/components/store/ProductReviews';
import { ProductQuestions } from '@/components/store/ProductQuestions';
import { ProductRail } from '@/components/store/ProductCard';
import { RecentlyViewed } from '@/components/store/RecentlyViewed';
import { FrequentlyBought } from '@/components/store/FrequentlyBought';

type Params = Promise<{ slug: string }>;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const getProduct = (slug: string) => serverApi<{ product: ProductDetail }>(`/products/${encodeURIComponent(slug)}`, { revalidate: 30 });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) return { title: 'Product not found' };
  const p = data.product;
  return {
    title: p.metaTitle || p.name,
    description: p.metaDescription || p.shortDescription || undefined,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, description: p.shortDescription ?? undefined, images: p.images[0] ? [{ url: p.images[0] }] : undefined, type: 'website' },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, related, settings] = await Promise.all([
    getProduct(slug),
    serverApi<{ related: ProductCard[]; frequentlyBoughtTogether: ProductCard[] }>(`/products/${encodeURIComponent(slug)}/related`),
    serverApi<{ settings: StoreSettings }>('/cms/settings'),
  ]);
  if (!data) notFound();
  const p = data.product;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.shortDescription,
    image: p.images.map((i) => `${SITE}${i}`),
    sku: p.variants[0]?.sku,
    brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
    aggregateRating: p.ratingCount ? { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount } : undefined,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.min(...p.variants.map((v) => v.price)) / 100,
      highPrice: Math.max(...p.variants.map((v) => v.price)) / 100,
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container-x pt-3 md:pt-4">
        <nav aria-label="Breadcrumb" className="scrollbar-none hidden flex-wrap items-center gap-1 text-[12px] text-muted md:flex">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          {p.breadcrumb.map((b) => (
            <span key={b.slug} className="flex items-center gap-1">
              <ChevronRight size={13} />
              <Link href={`/shop?category=${b.slug}`} className="hover:text-ink">
                {b.name}
              </Link>
            </span>
          ))}
          <ChevronRight size={13} />
          <span className="line-clamp-1 text-ink">{p.name}</span>
        </nav>

        <ProductView product={p} settings={settings?.settings ?? null} />
      </div>

      {!!related?.frequentlyBoughtTogether.length && <FrequentlyBought base={p} items={related.frequentlyBoughtTogether} />}

      <div className="container-x mt-2 grid gap-2 md:mt-3 md:gap-3 lg:grid-cols-[1fr_380px]">
        <ProductReviews productId={p.id} ratingAvg={p.ratingAvg} ratingCount={p.ratingCount} breakdown={p.ratingBreakdown} />
        <ProductQuestions productId={p.id} />
      </div>

      {!!related?.related.length && (
        <section className="container-x mt-2 md:mt-3">
          <div className="rounded-[var(--radius)] border border-line bg-surface p-3 md:p-5">
            <h2 className="mb-3 text-[17px] md:text-[21px]">You may also like</h2>
            <ProductRail items={related.related} />
          </div>
        </section>
      )}
      <RecentlyViewed excludeId={p.id} />
    </>
  );
}
