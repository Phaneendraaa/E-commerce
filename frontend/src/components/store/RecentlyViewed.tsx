'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ProductCard } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { ProductRail } from './ProductCard';

const KEY = 'sn_recent_products';

/** Remember a product view locally (works for guests too). */
export function rememberProduct(id: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    localStorage.setItem(KEY, JSON.stringify([id, ...list.filter((x) => x !== id)].slice(0, 16)));
  } catch {
    /* ignore */
  }
}

export function RecentlyViewed({ excludeId, title = 'Recently viewed' }: { excludeId?: string; title?: string }) {
  const status = useAuth((s) => s.status);
  const [items, setItems] = useState<ProductCard[]>([]);

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;
    const load = async () => {
      if (status === 'authed') {
        const r = await api<{ items: ProductCard[] }>('/products/recently-viewed').catch(() => ({ items: [] }));
        setItems(r.items);
      } else {
        let ids: string[] = [];
        try {
          ids = JSON.parse(localStorage.getItem(KEY) || '[]');
        } catch {
          /* ignore */
        }
        if (!ids.length) return;
        const r = await api<{ items: ProductCard[] }>('/products/by-ids', { query: { ids: ids.join(',') } }).catch(() => ({ items: [] }));
        setItems(r.items);
      }
    };
    void load();
  }, [status]);

  const list = items.filter((p) => p.id !== excludeId);
  if (list.length < 2) return null;
  return (
    <section className="container-x mt-3 md:mt-5">
      <div className="rounded-[var(--radius)] border border-line bg-surface p-3 md:p-5">
        <h2 className="mb-3 text-[17px] md:mb-4 md:text-[21px]">{title}</h2>
        <ProductRail items={list} />
      </div>
    </section>
  );
}
