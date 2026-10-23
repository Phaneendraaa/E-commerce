import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ChevronRight, SearchX } from 'lucide-react';
import { serverApi } from '@/lib/server-api';
import type { Category, Facets, ProductCard } from '@/lib/types';
import { ProductGrid } from '@/components/store/ProductCard';
import { ActiveFilters, MobileFilters, ShopFilters, SortSelect } from '@/components/store/ShopFilters';
import { Empty } from '@/components/ui';

type SP = Promise<Record<string, string | string[] | undefined>>;

interface ListResponse {
  items: ProductCard[];
  facets: Facets;
  category: (Category & { breadcrumb: { name: string; slug: string }[] }) | null;
  total: number;
  page: number;
  totalPages: number;
}

const KEYS = ['q', 'category', 'brand', 'minPrice', 'maxPrice', 'rating', 'inStock', 'onSale', 'featured', 'newArrival', 'deals', 'tag', 'options', 'sort', 'page'];

function toQuery(sp: Record<string, string | string[] | undefined>) {
  const p = new URLSearchParams();
  for (const k of KEYS) {
    const v = sp[k];
    if (typeof v === 'string' && v) p.set(k, v);
  }
  p.set('limit', '24');
  return p;
}

function heading(sp: Record<string, string | string[] | undefined>, cat: ListResponse['category']) {
  if (sp.q) return `Results for “${sp.q}”`;
  if (cat) return cat.name;
  if (sp.deals === 'true') return 'Deals of the day';
  if (sp.newArrival === 'true') return 'New arrivals';
  if (sp.onSale === 'true') return 'On sale';
  return 'All products';
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  if (typeof sp.category === 'string') {
    const data = await serverApi<ListResponse>(`/products?category=${encodeURIComponent(sp.category)}&limit=1`);
    if (data?.category) return { title: data.category.name, description: data.category.description ?? undefined, alternates: { canonical: `/shop?category=${sp.category}` } };
  }
  if (typeof sp.q === 'string') return { title: `Search: ${sp.q}`, robots: { index: false } };
  return { title: 'Shop all products' };
}

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const query = toQuery(sp);
  const [data, cats] = await Promise.all([serverApi<ListResponse>(`/products?${query}`, { revalidate: 30 }), serverApi<{ categories: Category[] }>('/categories')]);
  if (!data) return <div className="container-x py-16 text-center text-muted">Couldn’t load products right now. Please refresh.</div>;

  const cat = data.category;
  const root = cats?.categories.find((c) => c.slug === cat?.breadcrumb[0]?.slug);
  const subcats = cat ? (cats?.categories.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => c.id === cat.id)?.children ?? root?.children ?? []) : [];
  const page = data.page;

  const pageHref = (n: number) => {
    const p = new URLSearchParams(query);
    p.delete('limit');
    if (n === 1) p.delete('page');
    else p.set('page', String(n));
    return `/shop?${p.toString()}`;
  };

  return (
    <div className="container-x pt-3 md:pt-5">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <ChevronRight size={13} />
        <Link href="/shop" className="hover:text-ink">
          Shop
        </Link>
        {cat?.breadcrumb.map((b, i) => (
          <span key={b.slug} className="flex items-center gap-1">
            <ChevronRight size={13} />
            {i === cat.breadcrumb.length - 1 ? (
              <span className="text-ink">{b.name}</span>
            ) : (
              <Link href={`/shop?category=${b.slug}`} className="hover:text-ink">
                {b.name}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] md:text-[28px]">{heading(sp, cat)}</h1>
          <p className="mt-1 text-sm text-muted">
            {data.total} {data.total === 1 ? 'product' : 'products'}
            {cat?.description ? ` · ${cat.description}` : ''}
          </p>
        </div>
      </div>

      {subcats.length > 0 && (
        <div className="scrollbar-none -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {cat?.breadcrumb.length && cat.breadcrumb.length > 1 && root && (
            <Link href={`/shop?category=${root.slug}`} className="chip">
              All {root.name.toLowerCase()}
            </Link>
          )}
          {subcats.map((s) => (
            <Link key={s.id} href={`/shop?category=${s.slug}`} className="chip" data-active={s.slug === cat?.slug}>
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-6 md:mt-5 lg:gap-6">
        <Suspense>
          <ShopFilters facets={data.facets} />
        </Suspense>
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Suspense>
              <div className="flex flex-1 flex-wrap items-center gap-3">
                <MobileFilters facets={data.facets} total={data.total} />
                <ActiveFilters facets={data.facets} />
              </div>
              <SortSelect />
            </Suspense>
          </div>

          {data.items.length ? (
            <ProductGrid items={data.items} />
          ) : (
            <Empty
              icon={<SearchX size={26} />}
              title="No products match these filters"
              body={sp.q ? 'Check the spelling or try a more general term.' : 'Try removing a filter or two to see more products.'}
              action={
                <Link href="/shop" className="btn btn-primary">
                  Browse all products
                </Link>
              }
            />
          )}

          {data.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-1.5" aria-label="Pagination">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="chip">
                  Previous
                </Link>
              )}
              {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === data.totalPages || Math.abs(n - page) <= 1)
                .map((n, i, arr) => (
                  <span key={n} className="flex items-center gap-1.5">
                    {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
                    <Link href={pageHref(n)} className="chip min-w-9 justify-center" data-active={n === page} aria-current={n === page ? 'page' : undefined}>
                      {n}
                    </Link>
                  </span>
                ))}
              {page < data.totalPages && (
                <Link href={pageHref(page + 1)} className="chip">
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
