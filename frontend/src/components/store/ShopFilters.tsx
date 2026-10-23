'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import type { Facets } from '@/lib/types';
import { inr } from '@/lib/format';
import { Sheet, Stars } from '@/components/ui';

const COLOR_SWATCH: Record<string, string> = {
  Black: '#1f2937', White: '#f1f5f9', Navy: '#1e3a8a', Red: '#dc2626', Olive: '#4d7c0f', Beige: '#d6c4a8', Pink: '#ec4899', Blue: '#2563eb',
  Grey: '#9ca3af', Green: '#16a34a', Silver: '#cbd5e1', Gold: '#d4a017', Teal: '#0d9488', Purple: '#7c3aed', Orange: '#ea580c', Brown: '#92400e',
};

export const SORTS = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'popular', label: 'Bestselling' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'discount', label: 'Biggest discount' },
];

function useParamsEditor() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return { params, set };
}

function parseOptions(raw: string | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const [k, v] = part.split(':');
    if (k && v) out[k] = v.split('|').filter(Boolean);
  }
  return out;
}
const serializeOptions = (o: Record<string, string[]>) =>
  Object.entries(o)
    .filter(([, v]) => v.length)
    .map(([k, v]) => `${k}:${v.join('|')}`)
    .join(',');

function FilterBody({ facets }: { facets: Facets }) {
  const { params, set } = useParamsEditor();
  const brands = (params.get('brand') ?? '').split(',').filter(Boolean);
  const options = parseOptions(params.get('options'));
  const [min, setMin] = useState(params.get('minPrice') ? String(Number(params.get('minPrice')) / 100) : '');
  const [max, setMax] = useState(params.get('maxPrice') ? String(Number(params.get('maxPrice')) / 100) : '');
  useEffect(() => {
    setMin(params.get('minPrice') ? String(Number(params.get('minPrice')) / 100) : '');
    setMax(params.get('maxPrice') ? String(Number(params.get('maxPrice')) / 100) : '');
  }, [params]);

  const toggleBrand = (slug: string) => {
    const next = brands.includes(slug) ? brands.filter((b) => b !== slug) : [...brands, slug];
    set({ brand: next.join(',') || null });
  };
  const toggleOption = (name: string, value: string) => {
    const cur = options[name] ?? [];
    const next = { ...options, [name]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] };
    set({ options: serializeOptions(next) || null });
  };
  const flag = (k: string) => params.get(k) === 'true';

  const priceBands = (() => {
    const { min: lo, max: hi } = facets.price;
    if (!hi) return [];
    const steps = [50000, 100000, 250000, 500000, 1000000, 5000000];
    const bands: [number, number | null][] = [];
    let prev = 0;
    for (const s of steps) {
      if (s <= lo) continue;
      bands.push([prev, s]);
      prev = s;
      if (s >= hi) break;
    }
    if (prev < hi) bands.push([prev, null]);
    return bands.slice(0, 5);
  })();

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 font-semibold">Availability & offers</legend>
        <div className="space-y-2.5">
          {[
            ['inStock', 'In stock only'],
            ['onSale', 'On sale'],
            ['deals', 'Deals of the day'],
            ['newArrival', 'New arrivals'],
          ].map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={flag(k)} onChange={() => set({ [k]: flag(k) ? null : 'true' })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-semibold">Price</legend>
        <div className="space-y-2">
          {priceBands.map(([lo, hi]) => {
            const active = params.get('minPrice') === String(lo || '') && params.get('maxPrice') === (hi ? String(hi) : null);
            return (
              <label key={lo} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="radio" name="price-band" className="size-4 accent-[var(--ink)]" checked={Boolean(active)} onChange={() => set({ minPrice: lo ? String(lo) : null, maxPrice: hi ? String(hi) : null })} />
                {hi ? (lo ? `${inr(lo)} – ${inr(hi)}` : `Under ${inr(hi)}`) : `Over ${inr(lo)}`}
              </label>
            );
          })}
        </div>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            set({ minPrice: min ? String(Math.round(Number(min) * 100)) : null, maxPrice: max ? String(Math.round(Number(max) * 100)) : null });
          }}
        >
          <input value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} placeholder="Min ₹" inputMode="numeric" className="field !h-9 text-sm" aria-label="Minimum price" />
          <span className="text-muted">–</span>
          <input value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} placeholder="Max ₹" inputMode="numeric" className="field !h-9 text-sm" aria-label="Maximum price" />
          <button className="btn btn-outline btn-sm">Go</button>
        </form>
      </fieldset>

      {facets.brands.length > 0 && (
        <fieldset>
          <legend className="mb-3 font-semibold">Brand</legend>
          <div className="space-y-2.5">
            {facets.brands.map((b) => (
              <label key={b.slug} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={brands.includes(b.slug)} onChange={() => toggleBrand(b.slug)} />
                <span className="flex-1">{b.name}</span>
                <span className="text-xs text-faint">{b.count}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {Object.entries(facets.options).map(([name, values]) => (
        <fieldset key={name}>
          <legend className="mb-3 font-semibold">{name}</legend>
          {name === 'Color' ? (
            <div className="flex flex-wrap gap-2">
              {values.map((v) => {
                const on = options[name]?.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleOption(name, v)}
                    title={v}
                    aria-label={v}
                    aria-pressed={on}
                    className={`size-8 rounded-full ring-offset-2 transition ${on ? 'ring-2 ring-ink' : 'ring-1 ring-line hover:ring-ink'}`}
                    style={{ background: COLOR_SWATCH[v] ?? '#ddd' }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {values.map((v) => (
                <button key={v} type="button" onClick={() => toggleOption(name, v)} data-active={options[name]?.includes(v) ?? false} className="chip !h-8 !px-3">
                  {v}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      ))}

      {facets.ratings.some((r) => r.count > 0) && (
        <fieldset>
          <legend className="mb-3 font-semibold">Customer rating</legend>
          <div className="space-y-2">
            {facets.ratings
              .filter((r) => r.count > 0)
              .map((r) => (
                <label key={r.rating} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input type="radio" name="rating" className="size-4 accent-[var(--ink)]" checked={params.get('rating') === String(r.rating)} onChange={() => set({ rating: String(r.rating) })} />
                  <Stars value={r.rating} size={13} /> <span>& up</span>
                  <span className="ml-auto text-xs text-faint">{r.count}</span>
                </label>
              ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}

export function ShopFilters({ facets }: { facets: Facets }) {
  return (
    <aside className="hidden w-60 shrink-0 lg:block" aria-label="Filters">
      <div className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
        <FilterBody facets={facets} />
      </div>
    </aside>
  );
}

export function MobileFilters({ facets, total }: { facets: Facets; total: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="chip lg:hidden" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={15} /> Filters
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filters" width="max-w-sm">
        <div className="p-5 pb-24">
          <FilterBody facets={facets} />
        </div>
        <div className="sticky bottom-0 border-t border-line bg-surface p-4">
          <button className="btn btn-primary w-full" onClick={() => setOpen(false)}>
            Show {total} products
          </button>
        </div>
      </Sheet>
    </>
  );
}

export function SortSelect() {
  const { params, set } = useParamsEditor();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-muted sm:inline">Sort by</span>
      <select value={params.get('sort') ?? 'relevance'} onChange={(e) => set({ sort: e.target.value === 'relevance' ? null : e.target.value })} className="h-9 rounded-[var(--radius-sm)] border border-line bg-surface px-3 pr-8 text-sm font-medium">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Removable chips for every active filter. */
export function ActiveFilters({ facets }: { facets: Facets }) {
  const { params, set } = useParamsEditor();
  const chips: { label: string; clear: () => void }[] = [];
  const brands = (params.get('brand') ?? '').split(',').filter(Boolean);
  brands.forEach((b) => chips.push({ label: facets.brands.find((x) => x.slug === b)?.name ?? b, clear: () => set({ brand: brands.filter((x) => x !== b).join(',') || null }) }));
  const opts = parseOptions(params.get('options'));
  Object.entries(opts).forEach(([k, vals]) =>
    vals.forEach((v) => chips.push({ label: `${k}: ${v}`, clear: () => set({ options: serializeOptions({ ...opts, [k]: vals.filter((x) => x !== v) }) || null }) })),
  );
  if (params.get('minPrice') || params.get('maxPrice'))
    chips.push({
      label: `${params.get('minPrice') ? inr(Number(params.get('minPrice'))) : '₹0'} – ${params.get('maxPrice') ? inr(Number(params.get('maxPrice'))) : 'any'}`,
      clear: () => set({ minPrice: null, maxPrice: null }),
    });
  if (params.get('rating')) chips.push({ label: `${params.get('rating')}★ & up`, clear: () => set({ rating: null }) });
  (
    [
      ['inStock', 'In stock'],
      ['onSale', 'On sale'],
      ['deals', 'Deals'],
      ['newArrival', 'New arrivals'],
    ] as const
  ).forEach(([k, l]) => params.get(k) === 'true' && chips.push({ label: l, clear: () => set({ [k]: null }) }));
  if (params.get('q')) chips.push({ label: `“${params.get('q')}”`, clear: () => set({ q: null }) });

  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.label} onClick={c.clear} className="chip !h-8 bg-tile !border-transparent">
          {c.label} <X size={13} />
        </button>
      ))}
      <button
        onClick={() => set({ brand: null, options: null, minPrice: null, maxPrice: null, rating: null, inStock: null, onSale: null, deals: null, newArrival: null, q: null })}
        className="text-sm font-semibold underline underline-offset-4"
      >
        Clear all
      </button>
    </div>
  );
}
