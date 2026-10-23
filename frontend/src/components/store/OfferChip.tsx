'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { Offer } from '@/lib/types';
import { inr, offerLabel } from '@/lib/format';

/** Coupon shown as a tear-off ticket — copy the code with one tap. */
export function OfferChip({ o }: { o: Offer }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative flex min-w-[250px] flex-1 overflow-hidden rounded-[var(--radius)] border border-line bg-paper">
      <div className="flex-1 p-3">
        <div className="font-display text-[17px] font-semibold">{offerLabel(o)}</div>
        <p className="mt-1 text-[12px] leading-snug text-muted">{o.description ?? (o.minOrderValue ? `On orders above ${inr(o.minOrderValue)}` : 'On any order')}</p>
      </div>
      <div className="relative flex w-[104px] flex-col items-center justify-center border-l-2 border-dashed border-line bg-marigold-soft px-3">
        <span className="absolute -left-[9px] -top-2 size-4 rounded-full bg-surface" />
        <span className="absolute -bottom-2 -left-[9px] size-4 rounded-full bg-surface" />
        <span className="text-[14px] font-extrabold tracking-wide">{o.code}</span>
        <button
          onClick={async () => {
            await navigator.clipboard?.writeText(o.code).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-ink/70 hover:text-ink"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
