'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api, errorMessage } from '@/lib/api';
import { date } from '@/lib/format';
import { Loading, PageHeader, Panel, Toggle, useApi } from '@/components/admin/kit';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { Badge, Img, Sheet, Spinner } from '@/components/ui';

function BannerForm({ initial, onDone }: { initial: any; onDone: () => void }) {
  const [b, setB] = useState({ title: '', subtitle: '', image: '', link: '', ctaText: '', position: 'HERO', sortOrder: 0, isActive: true, startsAt: null, endsAt: null, ...initial });
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const { id, createdAt: _c, ...body } = b;
          await api(id ? `/admin/banners/${id}` : '/admin/banners', { method: id ? 'PUT' : 'POST', body: { ...body, sortOrder: Number(body.sortOrder) || 0 } });
          toast.success('Banner saved');
          onDone();
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <button type="button" onClick={() => setPick(true)} className="block w-full overflow-hidden rounded-[var(--radius-sm)] bg-tile ring-1 ring-line">
        {b.image ? <Img src={b.image} alt="" className="aspect-[5/2] w-full object-cover" /> : <span className="grid aspect-[5/2] place-items-center text-sm text-muted">Choose banner image (1600 × 640)</span>}
      </button>
      <label className="block">
        <span className="label">Headline</span>
        <input className="field" value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} required />
      </label>
      <label className="block">
        <span className="label">Subheading</span>
        <input className="field" value={b.subtitle ?? ''} onChange={(e) => setB({ ...b, subtitle: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Button text</span>
          <input className="field" value={b.ctaText ?? ''} onChange={(e) => setB({ ...b, ctaText: e.target.value })} placeholder="Shop now" />
        </label>
        <label className="block">
          <span className="label">Link</span>
          <input className="field" value={b.link ?? ''} onChange={(e) => setB({ ...b, link: e.target.value })} placeholder="/shop?category=fashion" />
        </label>
        <label className="block">
          <span className="label">Placement</span>
          <select className="field" value={b.position} onChange={(e) => setB({ ...b, position: e.target.value })}>
            <option value="HERO">Home hero</option>
            <option value="PROMO_STRIP">Promo strip</option>
            <option value="MID">Mid-page</option>
            <option value="CATEGORY">Category pages</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Order</span>
          <input type="number" className="field" value={b.sortOrder} onChange={(e) => setB({ ...b, sortOrder: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Show from</span>
          <input type="datetime-local" className="field" value={b.startsAt ? new Date(b.startsAt).toISOString().slice(0, 16) : ''} onChange={(e) => setB({ ...b, startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </label>
        <label className="block">
          <span className="label">Until</span>
          <input type="datetime-local" className="field" value={b.endsAt ? new Date(b.endsAt).toISOString().slice(0, 16) : ''} onChange={(e) => setB({ ...b, endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </label>
      </div>
      <label className="flex items-center justify-between text-sm">
        Active <Toggle checked={b.isActive} onChange={(v) => setB({ ...b, isActive: v })} label="Active" />
      </label>
      <button disabled={busy || !b.image} className="btn btn-primary w-full">
        {busy ? <Spinner /> : 'Save banner'}
      </button>
      <MediaPicker open={pick} multiple={false} onClose={() => setPick(false)} onPick={(p) => setB({ ...b, image: p[0] })} />
    </form>
  );
}

function PageForm({ initial, onDone }: { initial: any; onDone: () => void }) {
  const [p, setP] = useState({ slug: '', title: '', content: '', isPublished: true, ...initial });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  return (
    <form
      className="flex h-full flex-col gap-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const body = { slug: p.slug, title: p.title, content: p.content, isPublished: p.isPublished };
          await api(p.id ? `/admin/pages/${p.id}` : '/admin/pages', { method: p.id ? 'PUT' : 'POST', body });
          toast.success('Page saved');
          onDone();
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Title</span>
          <input className="field" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} required />
        </label>
        <label className="block">
          <span className="label">URL: /pages/…</span>
          <input className="field" value={p.slug} onChange={(e) => setP({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} required />
        </label>
      </div>
      <div className="flex gap-2">
        {(['write', 'preview'] as const).map((t) => (
          <button type="button" key={t} data-active={tab === t} onClick={() => setTab(t)} className="chip">
            {t === 'write' ? 'Markdown' : 'Preview'}
          </button>
        ))}
      </div>
      {tab === 'write' ? (
        <textarea className="field min-h-[320px] flex-1 font-mono text-[13px]" value={p.content} onChange={(e) => setP({ ...p, content: e.target.value })} />
      ) : (
        <div className="prose-store min-h-[320px] flex-1 overflow-y-auto rounded-[var(--radius-sm)] bg-tile/50 p-4">
          <ReactMarkdown>{p.content}</ReactMarkdown>
        </div>
      )}
      <label className="flex items-center justify-between text-sm">
        Published <Toggle checked={p.isPublished} onChange={(v) => setP({ ...p, isPublished: v })} label="Published" />
      </label>
      <button disabled={busy} className="btn btn-primary">
        {busy ? <Spinner /> : 'Save page'}
      </button>
    </form>
  );
}

export default function ContentPage() {
  const banners = useApi<{ banners: any[] }>('/admin/banners');
  const pages = useApi<{ pages: any[] }>('/admin/pages');
  const [banner, setBanner] = useState<any | null>(null);
  const [page, setPage] = useState<any | null>(null);

  return (
    <div>
      <PageHeader title="Banners & pages" description="Home page hero slides and the store’s info pages" />
      <Panel
        title="Banners"
        actions={
          <button onClick={() => setBanner({})} className="btn btn-primary btn-sm">
            <Plus size={15} /> Add banner
          </button>
        }
      >
        {!banners.data ? (
          <Loading />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {banners.data.banners.map((b) => (
              <div key={b.id} className="overflow-hidden rounded-[var(--radius-sm)] ring-1 ring-line">
                <Img src={b.image} alt="" className="aspect-[5/2] w-full bg-tile object-cover" />
                <div className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{b.title}</div>
                    <div className="text-xs text-muted">
                      {b.position.toLowerCase().replace('_', ' ')} · #{b.sortOrder}
                      {b.endsAt && ` · until ${date(b.endsAt)}`}
                    </div>
                  </div>
                  {!b.isActive && <Badge>Hidden</Badge>}
                  <button onClick={() => setBanner(b)} className="text-muted hover:text-ink" aria-label="Edit banner">
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Delete this banner?')) return;
                      await api(`/admin/banners/${b.id}`, { method: 'DELETE' });
                      banners.reload();
                    }}
                    className="text-muted hover:text-danger"
                    aria-label="Delete banner"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Pages"
        className="mt-5"
        padded={false}
        actions={
          <button onClick={() => setPage({})} className="btn btn-primary btn-sm">
            <Plus size={15} /> New page
          </button>
        }
      >
        <ul className="divide-y divide-line">
          {pages.data?.pages.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <div className="flex-1">
                <div className="font-semibold">{p.title}</div>
                <div className="text-xs text-muted">
                  /pages/{p.slug} · updated {date(p.updatedAt)}
                </div>
              </div>
              {!p.isPublished && <Badge>Draft</Badge>}
              <a href={`/pages/${p.slug}`} target="_blank" className="text-muted hover:text-ink" aria-label="View page">
                <ExternalLink size={15} />
              </a>
              <button onClick={() => setPage(p)} className="text-muted hover:text-ink" aria-label="Edit page">
                <Pencil size={15} />
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Delete “${p.title}”?`)) return;
                  await api(`/admin/pages/${p.id}`, { method: 'DELETE' });
                  pages.reload();
                }}
                className="text-muted hover:text-danger"
                aria-label="Delete page"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Sheet open={banner !== null} onClose={() => setBanner(null)} title={banner?.id ? 'Edit banner' : 'New banner'} width="max-w-lg">
        {banner && (
          <BannerForm
            initial={banner}
            onDone={() => {
              setBanner(null);
              banners.reload();
            }}
          />
        )}
      </Sheet>
      <Sheet open={page !== null} onClose={() => setPage(null)} title={page?.id ? `Edit ${page.title}` : 'New page'} width="max-w-3xl">
        {page && (
          <PageForm
            initial={page}
            onDone={() => {
              setPage(null);
              pages.reload();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
