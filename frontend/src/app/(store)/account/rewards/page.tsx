'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { date, inr } from '@/lib/format';

interface Loyalty {
  points: number;
  referralCode: string;
  referrals: number;
  history: { id: string; points: number; reason: string; createdAt: string }[];
}

export default function RewardsPage() {
  const [data, setData] = useState<Loyalty | null>(null);
  useEffect(() => {
    api<Loyalty>('/users/me/loyalty')
      .then(setData)
      .catch(() => undefined);
  }, []);
  if (!data) return <div className="skeleton h-72" />;

  const link = typeof window !== 'undefined' ? `${location.origin}/register?ref=${data.referralCode}` : '';
  const share = async () => {
    const text = `Join me on this store and get bonus reward points on your first order: ${link}`;
    if (navigator.share) await navigator.share({ text, url: link }).catch(() => undefined);
    else {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied');
    }
  };

  return (
    <div>
      <h1 className="text-[22px] md:text-[28px]">Rewards & referrals</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-ink p-6 text-white">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-marigold" />
          <div className="relative">
            <div className="text-sm text-white/70">Available points</div>
            <div className="font-display text-5xl font-extrabold">{data.points}</div>
            <div className="mt-1 text-sm text-white/80">Worth {inr(data.points * 100)} at checkout</div>
            <p className="mt-6 text-xs text-white/60">Earn 1 point for every ₹100 you spend. Redeem up to 20% of an order’s value.</p>
          </div>
        </div>
        <div className="rounded-[var(--radius)] border border-line bg-surface p-4">
          <div className="font-semibold">Invite friends, earn together</div>
          <p className="mt-1 text-sm text-muted">When a friend signs up with your code and their first order is delivered, you both get bonus points.</p>
          <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-ink bg-marigold-soft px-4 py-3">
            <span className="flex-1 font-display text-xl font-bold tracking-wider">{data.referralCode}</span>
            <button onClick={() => (navigator.clipboard.writeText(data.referralCode), toast.success('Code copied'))} className="btn btn-ghost btn-sm" aria-label="Copy code">
              <Copy size={16} />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted">{data.referrals} friends joined</span>
            <button onClick={share} className="btn btn-primary btn-sm">
              <Share2 size={15} /> Share invite
            </button>
          </div>
        </div>
      </div>

      <h2 className="mt-10 text-2xl">Points history</h2>
      <ul className="mt-4 divide-y divide-line rounded-[var(--radius)] bg-surface ring-1 ring-line">
        {data.history.map((h) => (
          <li key={h.id} className="flex items-center justify-between px-5 py-3.5 text-sm">
            <div>
              <div className="font-medium">{h.reason}</div>
              <div className="text-xs text-muted">{date(h.createdAt)}</div>
            </div>
            <span className={`font-display text-lg font-bold ${h.points > 0 ? 'text-peacock' : 'text-rose'}`}>
              {h.points > 0 ? '+' : ''}
              {h.points}
            </span>
          </li>
        ))}
        {!data.history.length && <li className="px-5 py-8 text-center text-sm text-muted">Your points activity will appear here.</li>}
      </ul>
    </div>
  );
}
