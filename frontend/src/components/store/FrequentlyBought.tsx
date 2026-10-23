'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { ProductCard, ProductDetail } from '@/lib/types';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import { Img } from '@/components/ui';
import { useCart } from '@/store/cart';

/** "Frequently bought together" bundle — mined from real order co-occurrence. */
export function FrequentlyBought({ base, items }: { base: ProductDetail; items: ProductCard[] }) {
  const add = useCart((s) => s.add);
  const open = useCart((s) => s.openDrawer);
  const all = [{ id: base.id, name: base.name, slug: base.slug, images: base.images, price: base.price, inStock: base.inStock }, ...items.filter((i) => i.inStock)];
  const [picked, setPicked] = useState<Set<string>>(new Set(all.map((a) => a.id)));
  const [busy, setBusy] = useState(false);
  if (all.length < 2) return null;
  const total = all.filter((a) => picked.has(a.id)).reduce((s, a) => s + a.price, 0);

  const addAll = async () => {
    setBusy(true);
    for (const a of all.filter((x) => picked.has(x.id))) {
      // Use the first in-stock variant of each product
      const r = await api<{ product: ProductDetail }>(`/products/${a.slug}`).catch(() => null);
      const v = r?.product.variants.find((x) => x.inStock);
      if (v) await add(v.id, 1, { productId: a.id, price: v.price, silent: true });
    }
    setBusy(false);
    open();
  };

  return (
    <section className="container-x mt-3 md:mt-5">
      <h2 className="mb-5 text-[17px] md:text-[21px]">Frequently bought together</h2>
      <div className="flex flex-col gap-6 rounded-[var(--radius)] border border-line bg-surface p-3 md:flex-row md:items-center md:p-7">
        <div className="flex flex-1 items-center gap-2 overflow-x-auto md:gap-4">
          {all.map((a, i) => (
            <div key={a.id} className="flex items-center gap-2 md:gap-4">
              {i > 0 && <Plus size={18} className="shrink-0 text-faint" />}
              <label className="relative block w-28 shrink-0 cursor-pointer md:w-36">
                <input
                  type="checkbox"
                  className="absolute left-2 top-2 z-10 size-4 accent-[var(--ink)]"
                  checked={picked.has(a.id)}
                  onChange={() => {
                    const n = new Set(picked);
                    if (n.has(a.id)) n.delete(a.id);
                    else n.add(a.id);
                    setPicked(n);
                  }}
                  aria-label={`Include ${a.name}`}
                />
                <Img src={a.images[0]} alt={a.name} className={`aspect-square w-full rounded-[var(--radius-sm)] bg-tile object-cover transition ${picked.has(a.id) ? '' : 'opacity-40'}`} />
                <Link href={`/product/${a.slug}`} className="mt-2 line-clamp-2 text-xs font-medium hover:underline">
                  {i === 0 ? 'This item: ' : ''}
                  {a.name}
                </Link>
                <div className="price mt-0.5 text-sm">{inr(a.price)}</div>
              </label>
            </div>
          ))}
        </div>
        <div className="shrink-0 md:w-56">
          <div className="text-sm text-muted">Total for {picked.size} items</div>
          <div className="price text-2xl">{inr(total)}</div>
          <button disabled={busy || !picked.size} onClick={addAll} className="btn btn-primary mt-3 w-full">
            {busy ? 'Adding…' : `Add ${picked.size} to cart`}
          </button>
        </div>
      </div>
    </section>
  );
}
