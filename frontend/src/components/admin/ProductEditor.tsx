'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2, Wand2, X } from 'lucide-react';
import { api, ApiError, errorMessage } from '@/lib/api';
import { Panel, Toggle, useApi } from '@/components/admin/kit';
import { ImageListField, MediaPicker } from '@/components/admin/MediaPicker';
import { Img, Spinner } from '@/components/ui';

/* Prices are edited in rupees and stored in paise. */
const toPaise = (r: string) => (r === '' ? null : Math.round(Number(r) * 100));
const toRupees = (p: number | null | undefined) => (p === null || p === undefined ? '' : String(p / 100));

interface VariantRow {
  id?: string;
  sku: string;
  options: Record<string, string>;
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stock: string;
  lowStockThreshold: string;
  image: string | null;
  isActive: boolean;
}

interface Form {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  brandId: string;
  images: string[];
  tags: string;
  specs: { label: string; value: string }[];
  options: { name: string; values: string[] }[];
  variants: VariantRow[];
  taxRate: string;
  hsnCode: string;
  weightGrams: string;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  dealEndsAt: string;
  metaTitle: string;
  metaDescription: string;
}

const blankVariant = (sku = ''): VariantRow => ({ sku, options: {}, price: '', compareAtPrice: '', costPrice: '', stock: '0', lowStockThreshold: '5', image: null, isActive: true });

const emptyForm: Form = {
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  categoryId: '',
  brandId: '',
  images: [],
  tags: '',
  specs: [],
  options: [],
  variants: [blankVariant()],
  taxRate: '18',
  hsnCode: '',
  weightGrams: '',
  isActive: true,
  isFeatured: false,
  isNewArrival: true,
  dealEndsAt: '',
  metaTitle: '',
  metaDescription: '',
};

function fromProduct(p: any): Form {
  const options = (p.optionNames as string[]).map((name) => ({ name, values: [...new Set((p.variants as any[]).map((v) => v.options[name]).filter(Boolean))] as string[] }));
  return {
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    categoryId: p.categoryId,
    brandId: p.brandId ?? '',
    images: p.images,
    tags: p.tags.join(', '),
    specs: p.specs ?? [],
    options,
    variants: p.variants.map((v: any) => ({
      id: v.id,
      sku: v.sku,
      options: v.options,
      price: toRupees(v.price),
      compareAtPrice: toRupees(v.compareAtPrice),
      costPrice: toRupees(v.costPrice),
      stock: String(v.stock),
      lowStockThreshold: String(v.lowStockThreshold),
      image: v.image,
      isActive: v.isActive,
    })),
    taxRate: String(p.taxRate),
    hsnCode: p.hsnCode ?? '',
    weightGrams: p.weightGrams ? String(p.weightGrams) : '',
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    dealEndsAt: p.dealEndsAt ? new Date(p.dealEndsAt).toISOString().slice(0, 16) : '',
    metaTitle: p.metaTitle ?? '',
    metaDescription: p.metaDescription ?? '',
  };
}

function skuBase(name: string) {
  return (
    name
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 3)
      .map((w) => w.slice(0, 3))
      .join('-') || 'SKU'
  );
}

export function ProductEditor({ productId }: { productId?: string }) {
  const router = useRouter();
  const cats = useApi<{ categories: any[] }>('/admin/categories');
  const brands = useApi<{ brands: any[] }>('/admin/brands');
  const existing = useApi<{ product: any }>(productId ? `/admin/products/${productId}` : null);
  const [f, setF] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [optionDraft, setOptionDraft] = useState<Record<number, string>>({});
  const [imgFor, setImgFor] = useState<number | null>(null);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');

  useEffect(() => {
    if (existing.data) setF(fromProduct(existing.data.product));
  }, [existing.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const categoryOptions = useMemo(() => {
    const list = cats.data?.categories ?? [];
    const byParent = (pid: string | null, depth = 0): { id: string; label: string }[] =>
      list.filter((c) => c.parentId === pid).flatMap((c) => [{ id: c.id, label: `${'— '.repeat(depth)}${c.name}` }, ...byParent(c.id, depth + 1)]);
    return byParent(null);
  }, [cats.data]);

  /** Build the cartesian product of option values, keeping data for combos that already exist. */
  const generateVariants = () => {
    const opts = f.options.filter((o) => o.name && o.values.length);
    if (!opts.length) {
      set('variants', f.variants.length ? [{ ...f.variants[0], options: {} }] : [blankVariant(skuBase(f.name))]);
      return;
    }
    let combos: Record<string, string>[] = [{}];
    for (const o of opts) combos = combos.flatMap((c) => o.values.map((v) => ({ ...c, [o.name]: v })));
    const base = f.variants[0];
    const prefix = skuBase(f.name);
    const next = combos.map((combo) => {
      const match = f.variants.find((v) => opts.every((o) => v.options[o.name] === combo[o.name]));
      if (match) return { ...match, options: combo };
      const suffix = Object.values(combo)
        .map((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))
        .join('-');
      return { ...blankVariant(`${prefix}-${suffix}`), price: base?.price ?? '', compareAtPrice: base?.compareAtPrice ?? '', costPrice: base?.costPrice ?? '', options: combo };
    });
    set('variants', next);
    toast.success(`${next.length} variant${next.length === 1 ? '' : 's'} ready — fill in prices and stock`);
  };

  const updateVariant = (i: number, patch: Partial<VariantRow>) => set('variants', f.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const optionNames = f.options.filter((o) => o.name && o.values.length).map((o) => o.name);
    const body = {
      name: f.name,
      slug: f.slug || undefined,
      shortDescription: f.shortDescription || null,
      description: f.description || null,
      categoryId: f.categoryId,
      brandId: f.brandId || null,
      images: f.images,
      tags: f.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      specs: f.specs.filter((s) => s.label && s.value),
      optionNames,
      taxRate: Number(f.taxRate || 0),
      hsnCode: f.hsnCode || null,
      weightGrams: f.weightGrams ? Number(f.weightGrams) : null,
      isActive: f.isActive,
      isFeatured: f.isFeatured,
      isNewArrival: f.isNewArrival,
      dealEndsAt: f.dealEndsAt ? new Date(f.dealEndsAt).toISOString() : null,
      metaTitle: f.metaTitle || null,
      metaDescription: f.metaDescription || null,
      variants: f.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        options: Object.fromEntries(optionNames.map((n) => [n, v.options[n]]).filter(([, val]) => val)),
        price: toPaise(v.price) ?? 0,
        compareAtPrice: toPaise(v.compareAtPrice),
        costPrice: toPaise(v.costPrice),
        stock: Number(v.stock || 0),
        lowStockThreshold: Number(v.lowStockThreshold || 0),
        image: v.image,
        isActive: v.isActive,
      })),
    };
    if (!body.categoryId) {
      setSaving(false);
      return setErrors({ categoryId: 'Choose a category' });
    }
    if (body.variants.some((v) => !v.price)) {
      setSaving(false);
      return toast.error('Every variant needs a price');
    }
    try {
      const r = await api<{ product: { id: string; slug: string } }>(productId ? `/admin/products/${productId}` : '/admin/products', { method: productId ? 'PUT' : 'POST', body });
      toast.success(productId ? 'Product saved' : 'Product created');
      if (!productId) router.replace(`/admin/products/${r.product.id}`);
      else existing.reload();
    } catch (err) {
      const d = err instanceof ApiError ? (err.details as Record<string, string[]> | undefined) : undefined;
      if (d) setErrors(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v[0]])));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (productId && !existing.data) return <Spinner />;

  const margin = (v: VariantRow) => {
    const p = Number(v.price);
    const c = Number(v.costPrice);
    return p && c ? Math.round(((p - c) / p) * 100) : null;
  };

  return (
    <form onSubmit={save}>
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Products
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] md:text-[32px]">{productId ? f.name || 'Edit product' : 'New product'}</h1>
        <div className="ml-auto flex gap-2">
          {productId && (
            <>
              <a href={`/product/${f.slug}`} target="_blank" className="btn btn-ghost btn-sm">
                <ExternalLink size={15} /> View
              </a>
              <button
                type="button"
                onClick={async () => {
                  const r = await api<{ product: { id: string } }>(`/admin/products/${productId}/duplicate`, { method: 'POST' });
                  toast.success('Duplicated as a hidden draft');
                  router.push(`/admin/products/${r.product.id}`);
                }}
                className="btn btn-ghost btn-sm"
              >
                <Copy size={15} /> Duplicate
              </button>
            </>
          )}
          <button disabled={saving} className="btn btn-primary btn-sm">
            {saving ? <Spinner size={14} /> : productId ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel title="Details">
            <div className="grid gap-4">
              <label className="block">
                <span className="label">Name</span>
                <input className="field" value={f.name} onChange={(e) => set('name', e.target.value)} required aria-invalid={Boolean(errors.name)} />
                {errors.name && <span className="text-xs text-danger">{errors.name}</span>}
              </label>
              <label className="block">
                <span className="label">Short description</span>
                <input className="field" value={f.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} maxLength={500} placeholder="One line shown under the title and in search results" />
              </label>
              <label className="block">
                <span className="label">
                  Description <span className="font-normal text-muted">(Markdown supported)</span>
                </span>
                <textarea className="field font-mono text-[13px]" rows={8} value={f.description} onChange={(e) => set('description', e.target.value)} />
              </label>
            </div>
          </Panel>

          <Panel title="Images" description="The first image is the main one. Images are stored in the storefront’s /public/images folder.">
            <ImageListField value={f.images} onChange={(v) => set('images', v)} />
          </Panel>

          <Panel title="Options & variants" description="Add options like Size or Color, then generate a variant for every combination.">
            <div className="space-y-3">
              {f.options.map((o, i) => (
                <div key={i} className="rounded-[var(--radius-sm)] bg-tile/60 p-3">
                  <div className="flex gap-2">
                    <input
                      list="option-names"
                      className="field !h-9 max-w-[180px] text-sm"
                      value={o.name}
                      onChange={(e) => set('options', f.options.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                      placeholder="Option name"
                      aria-label="Option name"
                    />
                    <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-[var(--radius-sm)] border-[1.5px] border-line bg-surface px-2 py-1">
                      {o.values.map((v) => (
                        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-tile px-2 py-0.5 text-xs font-medium">
                          {v}
                          <button type="button" onClick={() => set('options', f.options.map((x, k) => (k === i ? { ...x, values: x.values.filter((y) => y !== v) } : x)))} aria-label={`Remove ${v}`}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <input
                        value={optionDraft[i] ?? ''}
                        onChange={(e) => setOptionDraft({ ...optionDraft, [i]: e.target.value })}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ',') && optionDraft[i]?.trim()) {
                            e.preventDefault();
                            const val = optionDraft[i].trim();
                            if (!o.values.includes(val)) set('options', f.options.map((x, k) => (k === i ? { ...x, values: [...x.values, val] } : x)));
                            setOptionDraft({ ...optionDraft, [i]: '' });
                          }
                        }}
                        placeholder={o.values.length ? '' : 'Type a value and press Enter'}
                        className="h-7 min-w-[120px] flex-1 bg-transparent text-sm outline-none"
                        aria-label="Add option value"
                      />
                    </div>
                    <button type="button" onClick={() => set('options', f.options.filter((_, k) => k !== i))} className="btn btn-ghost btn-sm !px-2 text-danger" aria-label="Remove option">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              <datalist id="option-names">
                {['Size', 'Color', 'Storage', 'Material', 'Pack'].map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-2">
                {f.options.length < 3 && (
                  <button type="button" onClick={() => set('options', [...f.options, { name: '', values: [] }])} className="btn btn-outline btn-sm">
                    <Plus size={15} /> Add option
                  </button>
                )}
                <button type="button" onClick={generateVariants} className="btn btn-accent btn-sm">
                  <Wand2 size={15} /> Generate variants
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4 text-sm">
              <span className="text-muted">Apply to all variants:</span>
              <input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} placeholder="Price ₹" className="field !h-8 !w-28 text-sm" aria-label="Price for all" />
              <button type="button" onClick={() => bulkPrice && set('variants', f.variants.map((v) => ({ ...v, price: bulkPrice })))} className="btn btn-ghost btn-sm">
                Set price
              </button>
              <input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} placeholder="Stock" className="field !h-8 !w-24 text-sm" aria-label="Stock for all" />
              <button type="button" onClick={() => bulkStock && set('variants', f.variants.map((v) => ({ ...v, stock: bulkStock })))} className="btn btn-ghost btn-sm">
                Set stock
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-2 pr-2 font-medium">Variant</th>
                    <th className="px-1 font-medium">Image</th>
                    <th className="px-1 font-medium">SKU</th>
                    <th className="px-1 font-medium">Price ₹</th>
                    <th className="px-1 font-medium">MRP ₹</th>
                    <th className="px-1 font-medium">Cost ₹</th>
                    <th className="px-1 font-medium">Stock</th>
                    <th className="px-1 font-medium">Alert at</th>
                    <th className="px-1 font-medium">Active</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {f.variants.map((v, i) => (
                    <tr key={v.id ?? i}>
                      <td className="py-2 pr-2 font-medium">
                        {Object.values(v.options).join(' / ') || 'Default'}
                        {margin(v) !== null && <div className="text-[11px] font-normal text-muted">{margin(v)}% margin</div>}
                      </td>
                      <td className="px-1">
                        <button type="button" onClick={() => setImgFor(i)} className="block size-9 overflow-hidden rounded bg-tile ring-1 ring-line" aria-label="Choose variant image">
                          {v.image ? <Img src={v.image} alt="" className="size-full object-cover" /> : <Plus size={14} className="m-auto text-muted" />}
                        </button>
                      </td>
                      <td className="px-1">
                        <input className="field !h-8 min-w-[130px] text-xs" value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} required aria-label="SKU" />
                      </td>
                      {(['price', 'compareAtPrice', 'costPrice'] as const).map((k) => (
                        <td key={k} className="px-1">
                          <input className="field !h-8 !w-24 text-xs" inputMode="decimal" value={v[k]} onChange={(e) => updateVariant(i, { [k]: e.target.value.replace(/[^\d.]/g, '') })} required={k === 'price'} aria-label={k} />
                        </td>
                      ))}
                      <td className="px-1">
                        <input className="field !h-8 !w-20 text-xs" inputMode="numeric" value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value.replace(/\D/g, '') })} aria-label="Stock" />
                      </td>
                      <td className="px-1">
                        <input className="field !h-8 !w-16 text-xs" inputMode="numeric" value={v.lowStockThreshold} onChange={(e) => updateVariant(i, { lowStockThreshold: e.target.value.replace(/\D/g, '') })} aria-label="Low stock alert" />
                      </td>
                      <td className="px-1">
                        <Toggle checked={v.isActive} onChange={(x) => updateVariant(i, { isActive: x })} label="Active" />
                      </td>
                      <td className="pl-1">
                        {f.variants.length > 1 && (
                          <button type="button" onClick={() => set('variants', f.variants.filter((_, k) => k !== i))} className="text-faint hover:text-danger" aria-label="Remove variant">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Specifications">
            <div className="space-y-2">
              {f.specs.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field !h-9 max-w-[220px] text-sm" value={s.label} onChange={(e) => set('specs', f.specs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} placeholder="Label (e.g. Material)" aria-label="Spec label" />
                  <input className="field !h-9 text-sm" value={s.value} onChange={(e) => set('specs', f.specs.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} placeholder="Value" aria-label="Spec value" />
                  <button type="button" onClick={() => set('specs', f.specs.filter((_, k) => k !== i))} className="btn btn-ghost btn-sm !px-2 text-danger" aria-label="Remove spec">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => set('specs', [...f.specs, { label: '', value: '' }])} className="btn btn-outline btn-sm">
                <Plus size={15} /> Add spec
              </button>
            </div>
          </Panel>

          <Panel title="Search engine listing">
            <div className="mb-4 rounded-[var(--radius-sm)] bg-tile/60 p-4">
              <div className="truncate text-[13px] text-peacock">yourstore.com/product/{f.slug || 'product-url'}</div>
              <div className="truncate text-lg text-[#1a0dab]">{f.metaTitle || f.name || 'Product title'}</div>
              <div className="line-clamp-2 text-sm text-muted">{f.metaDescription || f.shortDescription || 'Add a short description to improve how this product appears in Google.'}</div>
            </div>
            <div className="grid gap-3">
              <label className="block">
                <span className="label">URL handle</span>
                <input className="field" value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="Generated from the name if left empty" />
              </label>
              <label className="block">
                <span className="label">Meta title</span>
                <input className="field" value={f.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} maxLength={200} />
              </label>
              <label className="block">
                <span className="label">Meta description</span>
                <textarea className="field" rows={2} value={f.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} maxLength={500} />
              </label>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Visibility">
            <div className="space-y-3 text-sm">
              {(
                [
                  ['isActive', 'Visible in store'],
                  ['isFeatured', 'Featured on home page'],
                  ['isNewArrival', 'Show “New” badge'],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="flex items-center justify-between">
                  {l} <Toggle checked={f[k]} onChange={(v) => set(k, v)} label={l} />
                </label>
              ))}
              <label className="block pt-2">
                <span className="label">
                  Deal of the day ends <span className="font-normal text-muted">(shows a countdown)</span>
                </span>
                <input type="datetime-local" className="field" value={f.dealEndsAt} onChange={(e) => set('dealEndsAt', e.target.value)} />
              </label>
            </div>
          </Panel>
          <Panel title="Organisation">
            <div className="space-y-3">
              <label className="block">
                <span className="label">Category</span>
                <select className="field" value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} aria-invalid={Boolean(errors.categoryId)}>
                  <option value="">Select a category</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errors.categoryId && <span className="text-xs text-danger">{errors.categoryId}</span>}
              </label>
              <label className="block">
                <span className="label">Brand</span>
                <select className="field" value={f.brandId} onChange={(e) => set('brandId', e.target.value)}>
                  <option value="">No brand</option>
                  {brands.data?.brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Tags</span>
                <input className="field" value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="cotton, summer, gift" />
                <span className="text-xs text-muted">Comma separated — used by search</span>
              </label>
            </div>
          </Panel>
          <Panel title="Tax & shipping">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">GST %</span>
                <select className="field" value={f.taxRate} onChange={(e) => set('taxRate', e.target.value)}>
                  {[0, 3, 5, 12, 18, 28].map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">HSN code</span>
                <input className="field" value={f.hsnCode} onChange={(e) => set('hsnCode', e.target.value)} />
              </label>
              <label className="col-span-2 block">
                <span className="label">Weight (grams)</span>
                <input className="field" inputMode="numeric" value={f.weightGrams} onChange={(e) => set('weightGrams', e.target.value.replace(/\D/g, ''))} />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">Prices include GST. The invoice splits it into CGST/SGST.</p>
          </Panel>
        </div>
      </div>

      <MediaPicker
        open={imgFor !== null}
        multiple={false}
        onClose={() => setImgFor(null)}
        onPick={(p) => {
          if (imgFor !== null) updateVariant(imgFor, { image: p[0] });
          if (p[0] && !f.images.includes(p[0])) set('images', [...f.images, p[0]]);
        }}
      />
    </form>
  );
}
