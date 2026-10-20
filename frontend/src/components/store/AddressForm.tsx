'use client';

import { useState } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import { INDIAN_STATES } from '@/lib/format';
import type { Address } from '@/lib/types';
import { Spinner } from '@/components/ui';

export type AddressInput = Omit<Address, 'id' | 'country'> & { country?: string };

const empty: AddressInput = { fullName: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '', type: 'HOME', isDefault: false };

export function AddressForm({ initial, onSubmit, onCancel, submitLabel = 'Save address' }: { initial?: Partial<AddressInput>; onSubmit: (a: AddressInput) => Promise<void>; onCancel?: () => void; submitLabel?: string }) {
  const [a, setA] = useState<AddressInput>({ ...empty, ...initial });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setA({ ...a, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await onSubmit({ ...a, phone: a.phone.replace(/\s/g, ''), line2: a.line2 || null, landmark: a.landmark || null });
    } catch (err) {
      const d = err instanceof ApiError ? (err.details as Record<string, string[]> | undefined) : undefined;
      setErrors(d ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k.replace('address.', ''), v[0]])) : { form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const err = (k: string) => errors[k] && <span className="mt-1 block text-xs text-danger">{errors[k]}</span>;

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <label className="block">
        <span className="label">Full name</span>
        <input className="field" value={a.fullName} onChange={set('fullName')} autoComplete="name" required aria-invalid={Boolean(errors.fullName)} />
        {err('fullName')}
      </label>
      <label className="block">
        <span className="label">Mobile number</span>
        <input className="field" value={a.phone} onChange={set('phone')} autoComplete="tel" inputMode="tel" placeholder="10-digit number" required aria-invalid={Boolean(errors.phone)} />
        {err('phone')}
      </label>
      <label className="block sm:col-span-2">
        <span className="label">House no., building, street</span>
        <input className="field" value={a.line1} onChange={set('line1')} autoComplete="address-line1" required aria-invalid={Boolean(errors.line1)} />
        {err('line1')}
      </label>
      <label className="block">
        <span className="label">
          Area, colony <span className="font-normal text-muted">(optional)</span>
        </span>
        <input className="field" value={a.line2 ?? ''} onChange={set('line2')} autoComplete="address-line2" />
      </label>
      <label className="block">
        <span className="label">
          Landmark <span className="font-normal text-muted">(optional)</span>
        </span>
        <input className="field" value={a.landmark ?? ''} onChange={set('landmark')} />
      </label>
      <label className="block">
        <span className="label">Pincode</span>
        <input className="field" value={a.pincode} onChange={(e) => setA({ ...a, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" autoComplete="postal-code" required aria-invalid={Boolean(errors.pincode)} />
        {err('pincode')}
      </label>
      <label className="block">
        <span className="label">City</span>
        <input className="field" value={a.city} onChange={set('city')} autoComplete="address-level2" required aria-invalid={Boolean(errors.city)} />
        {err('city')}
      </label>
      <label className="block sm:col-span-2">
        <span className="label">State</span>
        <select className="field" value={a.state} onChange={set('state')} required aria-invalid={Boolean(errors.state)}>
          <option value="">Select state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {err('state')}
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="label">Save as</legend>
        <div className="flex gap-2">
          {(['HOME', 'WORK', 'OTHER'] as const).map((t) => (
            <button type="button" key={t} onClick={() => setA({ ...a, type: t })} className="chip" data-active={a.type === t}>
              {t[0] + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="size-4 accent-[var(--ink)]" checked={a.isDefault} onChange={(e) => setA({ ...a, isDefault: e.target.checked })} /> Make this my default address
      </label>
      {errors.form && <p className="text-sm font-medium text-danger sm:col-span-2">{errors.form}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={busy} className="btn btn-primary">
          {busy ? <Spinner /> : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
