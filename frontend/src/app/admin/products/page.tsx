'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Plus } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { inr, num } from '@/lib/format';
import { Loading, PageHeader, Pager, Panel, SearchInput, Table, useApi } from '@/components/admin/kit';
import { Badge, Img, Stars } from '@/components/ui';

function ProductsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const get = (k: string, d = '') => params.get(k) ?? d;
  const set = (patch: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!('page' in patch)) p.delete('page');
    router.replace(`/admin/products?${p}`);
  };
  const query = { q: get('q'), category: get('category'), status: get('status', 'all'), stock: get('stock'), sort: get('sort', 'newest'), page: get('page', '1'), limit: 25 };
  const { data, reload } = useApi<any>('/admin/products', query);
  const cats = useApi<{ categories: any[] }>('/admin/categories');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const bulk = async (action: string) => {
    try {
      await api('/admin/products/bulk', { body: { ids: [...selected], action } });
      toast.success(`${selected.size} products updated`);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const remove = async (p: any) => {
    if (!confirm(`Delete “${p.name}”? Products with orders are archived instead.`)) return;
    try {
      const r = await api<{ message?: string }>(`/admin/products/${p.id}`, { method: 'DELETE' });
      toast.success(r.message ?? 'Product deleted');
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description={data ? `${data.total} products` : undefined}
        actions={
          <>
            <a href="/api/admin/products/export" className="btn btn-outline btn-sm">
              <Download size={15} /> Export CSV
            </a>
            <Link href="/admin/products/new" className="btn btn-primary btn-sm">
              <Plus size={15} /> Add product
            </Link>
          </>
        }
      />
      <Panel padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <SearchInput value={get('q')} onChange={(v) => set({ q: v })} placeholder="Name or SKU" />
          <select value={get('category')} onChange={(e) => set({ category: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="Category">
            <option value="">All categories</option>
            {cats.data?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? '— ' : ''}
                {c.name}
              </option>
            ))}
          </select>
          <select value={get('status', 'all')} onChange={(e) => set({ status: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="Status">
            <option value="all">Any status</option>
            <option value="active">Visible</option>
            <option value="inactive">Hidden</option>
          </select>
          <select value={get('stock')} onChange={(e) => set({ stock: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="Stock">
            <option value="">Any stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="in">In stock</option>
          </select>
          <select value={get('sort', 'newest')} onChange={(e) => set({ sort: e.target.value })} className="field !h-9 !w-auto text-sm" aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="sold">Best selling</option>
            <option value="stock">Lowest stock</option>
            <option value="price_desc">Price high–low</option>
            <option value="price_asc">Price low–high</option>
            <option value="name">Name</option>
          </select>
          {selected.size > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-1 rounded-full bg-marigold-soft py-1 pl-3 pr-1 text-sm">
              <b className="mr-1">{selected.size} selected</b>
              {[
                ['activate', 'Show'],
                ['deactivate', 'Hide'],
                ['feature', 'Feature'],
                ['unfeature', 'Unfeature'],
              ].map(([a, l]) => (
                <button key={a} onClick={() => bulk(a)} className="btn btn-ghost btn-sm !h-7">
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
        {!data ? (
          <Loading />
        ) : (
          <Table
            head={[
              <input key="all" type="checkbox" aria-label="Select all" className="size-4 accent-[var(--ink)]" checked={!!data.items.length && data.items.every((p: any) => selected.has(p.id))} onChange={(e) => setSelected(e.target.checked ? new Set(data.items.map((p: any) => p.id)) : new Set())} />,
              'Product',
              'Category',
              'Price',
              'Stock',
              'Sold',
              'Rating',
              'Status',
              '',
            ]}
          >
            {data.items.map((p: any) => (
              <tr key={p.id} className="hover:bg-tile/50">
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.name}`}
                    className="size-4 accent-[var(--ink)]"
                    checked={selected.has(p.id)}
                    onChange={() => {
                      const n = new Set(selected);
                      if (n.has(p.id)) n.delete(p.id);
                      else n.add(p.id);
                      setSelected(n);
                    }}
                  />
                </td>
                <td>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 hover:underline">
                    <Img src={p.image} alt="" className="size-11 rounded-md bg-tile object-cover" />
                    <span>
                      <span className="line-clamp-1 max-w-[280px] font-medium">{p.name}</span>
                      <span className="text-xs text-muted">
                        {p.brand ?? 'No brand'} · {p.variantCount} variant{p.variantCount === 1 ? '' : 's'}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="text-muted">{p.category}</td>
                <td className="tabular-nums">
                  {inr(p.price)}
                  {p.compareAtPrice > p.price && <div className="text-xs text-faint line-through">{inr(p.compareAtPrice)}</div>}
                </td>
                <td className="tabular-nums">
                  <span className={p.stock === 0 ? 'font-semibold text-danger' : ''}>{num(p.stock)}</span>
                  {p.lowStockVariants > 0 && <div className="text-xs text-rose">{p.lowStockVariants} low</div>}
                </td>
                <td className="tabular-nums">{num(p.soldCount)}</td>
                <td>{p.ratingCount ? <Stars value={p.ratingAvg} size={12} /> : <span className="text-xs text-faint">—</span>}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Visible' : 'Hidden'}</Badge>
                    {p.isFeatured && <Badge tone="accent">Featured</Badge>}
                  </div>
                </td>
                <td>
                  <button onClick={() => remove(p)} className="text-xs text-muted hover:text-danger">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
        {data && <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={(p) => set({ page: String(p) })} />}
      </Panel>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsInner />
    </Suspense>
  );
}
