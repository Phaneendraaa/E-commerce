'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Loading, PageHeader, Panel, Toggle, useApi } from '@/components/admin/kit';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { Badge, Img, Sheet, Spinner } from '@/components/ui';

interface Cat {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  productCount: number;
}

function CategoryForm({ initial, all, onDone }: { initial: Partial<Cat>; all: Cat[]; onDone: () => void }) {
  const [c, setC] = useState({ name: '', slug: '', description: '', image: '', parentId: '', sortOrder: 0, isActive: true, isFeatured: false, ...initial } as any);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState(false);
  return (
    <form
      className="space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const body = { name: c.name, slug: c.slug || undefined, description: c.description || null, image: c.image || null, parentId: c.parentId || null, sortOrder: Number(c.sortOrder) || 0, isActive: c.isActive, isFeatured: c.isFeatured };
          await api(initial.id ? `/admin/categories/${initial.id}` : '/admin/categories', { method: initial.id ? 'PUT' : 'POST', body });
          toast.success('Category saved');
          onDone();
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        <span className="label">Name</span>
        <input className="field" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} required />
      </label>
      <label className="block">
        <span className="label">Parent category</span>
        <select className="field" value={c.parentId ?? ''} onChange={(e) => setC({ ...c, parentId: e.target.value })}>
          <option value="">None (top level)</option>
          {all
            .filter((x) => x.id !== initial.id && !x.parentId)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Description</span>
        <textarea className="field" rows={2} value={c.description ?? ''} onChange={(e) => setC({ ...c, description: e.target.value })} />
      </label>
      <div className="flex items-center gap-3">
        <Img src={c.image} alt="" className="size-16 rounded-md bg-tile object-cover" />
        <button type="button" onClick={() => setPick(true)} className="btn btn-outline btn-sm">
          Choose image
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Sort order</span>
          <input className="field" type="number" value={c.sortOrder} onChange={(e) => setC({ ...c, sortOrder: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">URL handle</span>
          <input className="field" value={c.slug} onChange={(e) => setC({ ...c, slug: e.target.value })} placeholder="auto" />
        </label>
      </div>
      <label className="flex items-center justify-between text-sm">
        Visible <Toggle checked={c.isActive} onChange={(v) => setC({ ...c, isActive: v })} label="Visible" />
      </label>
      <label className="flex items-center justify-between text-sm">
        Featured on home page <Toggle checked={c.isFeatured} onChange={(v) => setC({ ...c, isFeatured: v })} label="Featured" />
      </label>
      <button disabled={busy} className="btn btn-primary w-full">
        {busy ? <Spinner /> : 'Save category'}
      </button>
      <MediaPicker open={pick} multiple={false} onClose={() => setPick(false)} onPick={(p) => setC({ ...c, image: p[0] })} />
    </form>
  );
}

export default function CategoriesPage() {
  const cats = useApi<{ categories: Cat[] }>('/admin/categories');
  const brands = useApi<{ brands: any[] }>('/admin/brands');
  const [editing, setEditing] = useState<Partial<Cat> | null>(null);
  const [brandName, setBrandName] = useState('');

  const all = cats.data?.categories ?? [];
  const roots = all.filter((c) => !c.parentId);

  const delCat = async (c: Cat) => {
    if (!confirm(`Delete “${c.name}”?`)) return;
    try {
      await api(`/admin/categories/${c.id}`, { method: 'DELETE' });
      cats.reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const Row = ({ c, child }: { c: Cat; child?: boolean }) => (
    <li className={`flex items-center gap-3 py-2.5 ${child ? 'pl-10' : ''}`}>
      <Img src={c.image} alt="" className="size-10 rounded-md bg-tile object-cover" />
      <div className="flex-1">
        <div className="font-medium">{c.name}</div>
        <div className="text-xs text-muted">
          /{c.slug} · {c.productCount} products
        </div>
      </div>
      {!c.isActive && <Badge>Hidden</Badge>}
      {c.isFeatured && <Badge tone="accent">Featured</Badge>}
      <button onClick={() => setEditing(c)} className="btn btn-ghost btn-sm !px-2" aria-label={`Edit ${c.name}`}>
        <Pencil size={15} />
      </button>
      <button onClick={() => delCat(c)} className="btn btn-ghost btn-sm !px-2 text-danger" aria-label={`Delete ${c.name}`}>
        <Trash2 size={15} />
      </button>
    </li>
  );

  return (
    <div>
      <PageHeader
        title="Categories & brands"
        actions={
          <button onClick={() => setEditing({})} className="btn btn-primary btn-sm">
            <Plus size={15} /> Add category
          </button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Categories">
          {!cats.data ? (
            <Loading />
          ) : (
            <ul className="divide-y divide-line">
              {roots.map((r) => (
                <li key={r.id}>
                  <ul className="divide-y divide-line">
                    <Row c={r} />
                    {all
                      .filter((c) => c.parentId === r.id)
                      .map((c) => (
                        <Row key={c.id} c={c} child />
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Brands">
          <form
            className="mb-4 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/admin/brands', { body: { name: brandName } });
                setBrandName('');
                brands.reload();
              } catch (err) {
                toast.error(errorMessage(err));
              }
            }}
          >
            <input className="field !h-9 text-sm" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="New brand name" required aria-label="Brand name" />
            <button className="btn btn-primary btn-sm !h-9">Add</button>
          </form>
          <ul className="divide-y divide-line text-sm">
            {brands.data?.brands.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 font-medium">{b.name}</span>
                <span className="text-xs text-muted">{b.productCount} products</span>
                <button
                  onClick={async () => {
                    const name = prompt('Rename brand', b.name);
                    if (!name) return;
                    await api(`/admin/brands/${b.id}`, { method: 'PUT', body: { name, logo: b.logo, isActive: b.isActive } }).catch((e) => toast.error(errorMessage(e)));
                    brands.reload();
                  }}
                  className="text-muted hover:text-ink"
                  aria-label={`Rename ${b.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete ${b.name}? Its products will have no brand.`)) return;
                    await api(`/admin/brands/${b.id}`, { method: 'DELETE' });
                    brands.reload();
                  }}
                  className="text-muted hover:text-danger"
                  aria-label={`Delete ${b.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? 'Edit category' : 'New category'} width="max-w-md">
        {editing && (
          <CategoryForm
            initial={editing}
            all={all}
            onDone={() => {
              setEditing(null);
              cats.reload();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
