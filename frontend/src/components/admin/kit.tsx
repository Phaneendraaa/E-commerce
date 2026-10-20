'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Spinner } from '@/components/ui';

/** Fetch hook for admin screens: refetches when the path/query change. */
export function useApi<T>(path: string | null, query?: Record<string, any>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = path ? path + JSON.stringify(query ?? {}) : null;
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const r = await api<T>(path, { query });
      if (n === seq.current) {
        setData(r);
        setError(null);
      }
    } catch (e) {
      if (n === seq.current) setError(errorMessage(e));
    } finally {
      if (n === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] md:text-[32px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, padded = true, description }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('rounded-[var(--radius)] bg-surface ring-1 ring-line', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4">
          <div>
            {title && <h2 className="font-sans text-[15px] font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function Delta({ value, invert, className }: { value: number; invert?: boolean; className?: string }) {
  if (!Number.isFinite(value) || value === 0) return <span className={clsx('text-xs text-muted', className)}>no change</span>;
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={clsx('inline-flex items-center gap-0.5 text-xs font-semibold', good ? 'text-peacock' : 'text-danger', className)}>
      <Icon size={14} aria-hidden />
      {Math.abs(value).toFixed(1)}%<span className="sr-only">{value > 0 ? ' increase' : ' decrease'}</span>
    </span>
  );
}

export function Loading({ className }: { className?: string }) {
  return (
    <div className={clsx('grid place-items-center py-16 text-muted', className)}>
      <Spinner size={22} />
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-rose-soft p-4 text-sm text-danger">
      {message}{' '}
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => v !== value && onChange(v), 300);
    return () => clearTimeout(t);
  }, [v, value, onChange]);
  return (
    <label className="relative block w-full max-w-xs">
      <span className="sr-only">{placeholder}</span>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="field !h-9 pl-9 text-sm" />
    </label>
  );
}

export function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return <div className="px-5 py-3 text-xs text-muted">{total} results</div>;
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
      <span className="text-xs text-muted">
        Page {page} of {totalPages} · {total} results
      </span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="btn btn-ghost btn-sm !px-2" aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="btn btn-ghost btn-sm !px-2" aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/** Simple, accessible data table. */
export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium first:pl-5 last:pr-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line [&_td]:px-4 [&_td]:py-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">{children}</tbody>
      </table>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={clsx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-ink' : 'bg-line')}>
      <span className={clsx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '12 months', days: 365 },
];

export function RangePicker({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <div className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line" role="radiogroup" aria-label="Date range">
      {RANGES.map((r) => (
        <button key={r.days} role="radio" aria-checked={days === r.days} onClick={() => onChange(r.days)} className={clsx('h-8 rounded-full px-3 text-xs font-semibold transition', days === r.days ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
          {r.label}
        </button>
      ))}
    </div>
  );
}
