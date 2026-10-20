import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/server-api';
import type { Category, ProductCard } from '@/lib/types';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cats, first] = await Promise.all([serverApi<{ categories: Category[] }>('/categories'), serverApi<{ items: ProductCard[]; totalPages: number }>('/products?limit=60&sort=newest')]);
  const products = [...(first?.items ?? [])];
  for (let p = 2; p <= Math.min(first?.totalPages ?? 1, 50); p++) {
    const r = await serverApi<{ items: ProductCard[] }>(`/products?limit=60&sort=newest&page=${p}`);
    products.push(...(r?.items ?? []));
  }
  const flat = (cats?.categories ?? []).flatMap((c) => [c, ...(c.children ?? [])]);
  const now = new Date();
  return [
    { url: SITE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/offers`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    ...flat.map((c) => ({ url: `${SITE}/shop?category=${c.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${SITE}/product/${p.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...['about', 'faq', 'shipping-policy', 'returns-policy', 'privacy-policy', 'terms'].map((s) => ({ url: `${SITE}/pages/${s}`, changeFrequency: 'monthly' as const, priority: 0.3 })),
  ];
}
