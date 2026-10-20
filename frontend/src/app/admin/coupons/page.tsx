'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { date, inr, offerLabel } from '@/lib/format';
import { Loading, PageHeader, Panel, Table, Toggle, useApi } from '@/components/admin/kit';
import { Badge, Sheet, Spinner } from '@/components/ui';

interface Coupon {
  id?: string;
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  usageLimit: number | null;
  perUserLimit: number;
  usedCount?: number;
  firstOrderOnly: boolean;
  applicableCategoryIds: string[];
  isActive: boolean;
  isPublic: boolean;
  startsAt: string | null;
  endsAt: string | null;
  revenue?: number;
  discountGiven?: number;
}

const blank: Coupon = { code: '', description: '', type: 'PERCENT', value: 10, maxDiscount: null, minOrderValue: 0, usageLimit: null, perUserLimit: 1, firstOrderOnly: false, applicableCategoryIds: [], isActive: true, isPublic: true, startsAt: null, endsAt: null };

function status(c: Coupon) {
  const now = Date.now();
  if (!c.isActive) return { label: 'Inactive', tone: 'neutral' as const };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { label: 'Expired', tone: 'danger' as const };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: 'Scheduled', tone: 'info' as const };
  if (c.usageLimit && (c.usedCount ?? 0) >= c.usageLimit) return { label: 'Used up', tone: 'warn' as const };
  return { label: 'Live', tone: 'success' as const };
}

function CouponForm({ initial, onDone }: { initial: Coupon; onDone: () => void }) {
  const cats = useApi<{ categories: any[] }>('/admin/categories');
  const [c, setC] = useState({
    ...initial,
    valueInput: initial.type === 'FLAT' ? String(initial.value / 100) : String(initial.value),
    maxInput: initial.maxDiscount ? String(initial.maxDiscount / 100) : '',
    minInput: initial.minOrderValue ? String(initial.minOrderValue / 100) : '',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof c>) => setC({ ...c, ...patch });
  const dt = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : '');

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const body = {
            code: c.code,
            description: c.description || null,
            type: c.type,
            value: c.type === 'FLAT' ? Math.round(Number(c.valueInput) * 100) : c.type === 'PERCENT' ? Number(c.valueInput) : 0,
            maxDiscount: c.type === 'PERCENT' && c.maxInput ? Math.round(Number(c.maxInput) * 100) : null,
            minOrderValue: c.minInput ? Math.round(Number(c.minInput) * 100) : 0,
            usageLimit: c.usageLimit || null,
            perUserLimit: c.perUserLimit || 1,
            firstOrderOnly: c.firstOrderOnly,
            applicableCategoryIds: c.applicableCategoryIds,
            isActive: c.isActive,
            isPublic: c.isPublic,
            startsAt: c.startsAt || null,
            endsAt: c.endsAt || null,
          };
          await api(initial.id ? `/admin/coupons/${initial.id}` : '/admin/coupons', { method: initial.id ? 'PUT' : 'POST', body });
          toast.success('Coupon saved');
          onDone();
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        <span className="label">Code</span>
        <input className="field uppercase" value={c.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} required minLength={3} />
      </label>
      <label className="block">
        <span className="label">Description shown to customers</span>
        <input className="field" value={c.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. 15% off on orders above ₹1,999" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {(['PERCENT', 'FLAT', 'FREE_SHIPPING'] as const).map((t) => (
          <button type="button" key={t} onClick={() => set({ type: t })} data-active={c.type === t} className="chip justify-center">
            {t === 'PERCENT' ? '% off' : t === 'FLAT' ? '₹ off' : 'Free shipping'}
          </button>
        ))}
      </div>
      {c.type !== 'FREE_SHIPPING' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">{c.type === 'PERCENT' ? 'Percent' : 'Amount ₹'}</span>
            <input className="field" inputMode="decimal" value={c.valueInput} onChange={(e) => set({ valueInput: e.target.value.replace(/[^\d.]/g, '') })} required />
          </label>
          {c.type === 'PERCENT' && (
            <label className="block">
              <span className="label">Max discount ₹</span>
              <input className="field" inputMode="decimal" value={c.maxInput} onChange={(e) => set({ maxInput: e.target.value.replace(/[^\d.]/g, '') })} placeholder="No cap" />
            </label>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="label">Min order ₹</span>
          <input className="field" inputMode="decimal" value={c.minInput} onChange={(e) => set({ minInput: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" />
        </label>
        <label className="block">
          <span className="label">Total uses</span>
          <input className="field" inputMode="numeric" value={c.usageLimit ?? ''} onChange={(e) => set({ usageLimit: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} placeholder="Unlimited" />
        </label>
        <label className="block">
          <span className="label">Per customer</span>
          <input className="field" inputMode="numeric" value={c.perUserLimit} onChange={(e) => set({ perUserLimit: Number(e.target.value.replace(/\D/g, '')) || 1 })} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Starts</span>
          <input type="datetime-local" className="field" value={dt(c.startsAt)} onChange={(e) => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </label>
        <label className="block">
          <span className="label">Ends</span>
          <input type="datetime-local" className="field" value={dt(c.endsAt)} onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </label>
      </div>
      <label className="block">
        <span className="label">Limit to categories</span>
        <select
          multiple
          className="field !h-28 py-1 text-sm"
          value={c.applicableCategoryIds}
          onChange={(e) => set({ applicableCategoryIds: [...e.target.selectedOptions].map((o) => o.value) })}
        >
          {cats.data?.categories.map((x) => (
            <option key={x.id} value={x.id}>
              {x.parentId ? '— ' : ''}
              {x.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">Leave empty for the whole store. Ctrl/⌘-click to pick several.</span>
      </label>
      <div className="space-y-3 text-sm">
        <label className="flex items-center justify-between">
          First order only <Toggle checked={c.firstOrderOnly} onChange={(v) => set({ firstOrderOnly: v })} label="First order only" />
        </label>
        <label className="flex items-center justify-between">
          Show on offers page <Toggle checked={c.isPublic} onChange={(v) => set({ isPublic: v })} label="Public" />
        </label>
        <label className="flex items-center justify-between">
          Active <Toggle checked={c.isActive} onChange={(v) => set({ isActive: v })} label="Active" />
        </label>
      </div>
      <button disabled={busy} className="btn btn-primary w-full">
        {busy ? <Spinner /> : 'Save coupon'}
      </button>
    </form>
  );
}

export default function CouponsPage() {
  const { data, reload } = useApi<{ coupons: Coupon[] }>('/admin/coupons');
  const [editing, setEditing] = useState<Coupon | null>(null);

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Discount codes, with redemptions and the revenue they drove"
        actions={
          <button onClick={() => setEditing(blank)} className="btn btn-primary btn-sm">
            <Plus size={15} /> Create coupon
          </button>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <Panel padded={false}>
          <Table head={['Code', 'Offer', 'Conditions', 'Used', 'Discount given', 'Revenue', 'Status', '']}>
            {data.coupons.map((c) => {
              const s = status(c);
              return (
                <tr key={c.id}>
                  <td>
                    <div className="font-display font-bold tracking-wide">{c.code}</div>
                    {!c.isPublic && <div className="text-xs text-muted">Private</div>}
                  </td>
                  <td>{offerLabel(c)}</td>
                  <td className="text-xs text-muted">
                    {c.minOrderValue ? `Min ${inr(c.minOrderValue)}` : 'No minimum'}
                    {c.firstOrderOnly && ' · first order'}
                    {c.applicableCategoryIds.length > 0 && ' · selected categories'}
                    {c.endsAt && <div>Ends {date(c.endsAt)}</div>}
                  </td>
                  <td className="tabular-nums">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="tabular-nums">{inr(c.discountGiven ?? 0, { compact: true })}</td>
                  <td className="font-semibold tabular-nums">{inr(c.revenue ?? 0, { compact: true })}</td>
                  <td>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(c)} className="btn btn-ghost btn-sm !px-2" aria-label={`Edit ${c.code}`}>
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete ${c.code}?`)) return;
                          const r = await api<{ message?: string }>(`/admin/coupons/${c.id}`, { method: 'DELETE' });
                          toast.success(r.message ?? 'Coupon deleted');
                          reload();
                        }}
                        className="btn btn-ghost btn-sm !px-2 text-danger"
                        aria-label={`Delete ${c.code}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.code}` : 'New coupon'} width="max-w-md">
        {editing && (
          <CouponForm
            initial={editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
