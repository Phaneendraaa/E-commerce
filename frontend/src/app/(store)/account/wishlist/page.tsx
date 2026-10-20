'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';
import type { ProductCard } from '@/lib/types';
import { useWishlist } from '@/store/wishlist';
import { ProductGrid, ProductGridSkeleton } from '@/components/store/ProductCard';
import { Empty } from '@/components/ui';

export default function WishlistPage() {
  const ids = useWishlist((s) => s.ids);
  const [items, setItems] = useState<ProductCard[] | null>(null);

  useEffect(() => {
    api<{ items: ProductCard[] }>('/wishlist')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  // Hide items the user un-hearts without refetching
  const visible = items?.filter((p) => ids.has(p.id));

  return (
    <div>
      <h1 className="text-[32px] md:text-[40px]">Wishlist</h1>
      <p className="mt-1 text-sm text-muted">We’ll keep these safe. Prices and stock update live.</p>
      <div className="mt-6">
        {!visible ? (
          <ProductGridSkeleton count={4} />
        ) : visible.length ? (
          <ProductGrid items={visible} className="lg:grid-cols-3 xl:grid-cols-4" />
        ) : (
          <Empty
            icon={<Heart size={26} />}
            title="Your wishlist is empty"
            body="Tap the heart on any product to save it for later."
            action={
              <Link href="/shop" className="btn btn-primary">
                Discover products
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
