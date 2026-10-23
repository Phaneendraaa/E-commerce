'use client';

import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Loader2, Star, X } from 'lucide-react';
import { inr } from '@/lib/format';

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center', className)} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-line" fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-marigold" fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Price({ price, compareAt, size = 'md', className }: { price: number; compareAt?: number | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const off = compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const main = { sm: 'text-[15px]', md: 'text-[17px]', lg: 'text-xl', xl: 'text-[26px]' }[size];
  return (
    <div className={clsx('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={clsx('price', main)}>{inr(price)}</span>
      {off > 0 && (
        <>
          <span className="text-[12px] text-faint line-through tabular-nums">{inr(compareAt!)}</span>
          <span className="text-[12px] font-bold text-peacock">{off}% off</span>
        </>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent'; className?: string }) {
  const tones = {
    neutral: 'bg-tile text-ink',
    info: 'bg-[#e3ecf7] text-[#1f4f86]',
    success: 'bg-peacock-soft text-peacock',
    warn: 'bg-marigold-soft text-[#7a5200]',
    danger: 'bg-rose-soft text-danger',
    accent: 'bg-marigold text-ink',
  };
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return <Loader2 size={size} className={clsx('animate-spin', className)} aria-hidden />;
}

/** Live countdown for flash deals. */
export function Countdown({ to, compact }: { to: string | Date; compact?: boolean }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className="tabular-nums">--:--:--</span>;
  const ms = Math.max(0, target - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (ms === 0) return <span>Deal ended</span>;
  if (compact) return <span className="tabular-nums">{h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${pad(h)}:${pad(m)}:${pad(s)}`}</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {[
        [h, 'h'],
        [m, 'm'],
        [s, 's'],
      ].map(([v, u]) => (
        <span key={u as string} className="rounded-md bg-ink px-1.5 py-0.5 text-xs font-bold text-white">
          {pad(v as number)}
          {u}
        </span>
      ))}
    </span>
  );
}

export function Img({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [err, setErr] = useState(false);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={!src || err ? '/images/placeholder.svg' : src} alt={alt} loading="lazy" decoding="async" onError={() => setErr(true)} className={className} />;
}

/** Accessible modal / drawer. */
export function Sheet({ open, onClose, title, children, side = 'right', width = 'max-w-md' }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; side?: 'right' | 'left' | 'center'; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          'absolute flex flex-col bg-surface shadow-2xl',
          side === 'right' ? `animate-slide-in right-0 top-0 h-full w-full ${width}` : side === 'left' ? `animate-slide-in-left left-0 top-0 h-full w-full ${width}` : `left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-32px)] ${width} -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)]`,
        )}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="font-display text-base font-semibold">{title}</div>
            <button onClick={onClose} className="btn btn-ghost btn-sm !px-2" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icon && <div className="mb-4 grid size-16 place-items-center rounded-full bg-tile text-ink">{icon}</div>}
      <h3 className="text-lg">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, className }: { label?: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function QtyStepper({ value, onChange, max = 10, disabled }: { value: number; onChange: (n: number) => void; max?: number; disabled?: boolean }) {
  return (
    <div className="inline-flex h-9 items-center rounded-[var(--radius-sm)] border border-line bg-surface">
      <button type="button" className="grid h-full w-9 place-items-center text-lg disabled:opacity-40" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} aria-label="Decrease quantity">
        −
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button type="button" className="grid h-full w-9 place-items-center text-lg disabled:opacity-40" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="Increase quantity">
        +
      </button>
    </div>
  );
}
