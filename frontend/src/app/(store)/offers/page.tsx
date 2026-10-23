import type { Metadata } from 'next';
import { serverApi } from '@/lib/server-api';
import type { Offer, ProductCard } from '@/lib/types';
import { OfferChip } from '@/components/store/OfferChip';
import { ProductGrid } from '@/components/store/ProductCard';

export const metadata: Metadata = { title: 'Offers & coupons' };
export const revalidate = 60;

export default async function OffersPage() {
  const [offers, deals] = await Promise.all([serverApi<{ offers: Offer[] }>('/cms/offers'), serverApi<{ items: ProductCard[] }>('/products?onSale=true&sort=discount&limit=8')]);
  return (
    <div className="container-x py-4 md:py-6">
      <h1 className="text-[24px] md:text-[32px]">Offers & coupons</h1>
      <p className="mt-2 max-w-xl text-muted">Copy a code and apply it in your cart. One coupon per order; reward points can be combined with any coupon.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {offers?.offers.map((o) => (
          <OfferChip key={o.code} o={o} />
        ))}
      </div>
      {!!deals?.items.length && (
        <section className="mt-6">
          <h2 className="mb-6 text-[18px] md:text-[22px]">Biggest discounts right now</h2>
          <ProductGrid items={deals.items} />
        </section>
      )}
    </div>
  );
}
