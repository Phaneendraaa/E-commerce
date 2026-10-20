'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { BadgeCheck, MessageSquareQuote, Star, ThumbsUp } from 'lucide-react';
import type { Paged, Review } from '@/lib/types';
import { api, errorMessage } from '@/lib/api';
import { date } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { Empty, Sheet, Spinner, Stars } from '@/components/ui';

export function ProductReviews({ productId, ratingAvg, ratingCount, breakdown }: { productId: string; ratingAvg: number; ratingCount: number; breakdown: { rating: number; count: number }[] }) {
  const status = useAuth((s) => s.status);
  const pathname = usePathname();
  const [data, setData] = useState<Paged<Review> | null>(null);
  const [sort, setSort] = useState('helpful');
  const [rating, setRating] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);
  const [eligible, setEligible] = useState<{ verifiedPurchase: boolean; hasReviewed: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await api<Paged<Review>>(`/products/${productId}/reviews`, { query: { sort, rating, page, limit: 6 } }).catch(() => null);
    if (r) setData((prev) => (page > 1 && prev ? { ...r, items: [...prev.items, ...r.items] } : r));
  }, [productId, sort, rating, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (status === 'authed') api(`/products/${productId}/reviews/eligibility`).then(setEligible).catch(() => undefined);
  }, [status, productId]);

  const vote = async (id: string) => {
    if (status !== 'authed') return toast('Sign in to vote on reviews');
    try {
      const r = await api<{ voted: boolean }>(`/reviews/${id}/helpful`, { method: 'POST' });
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === id ? { ...x, votedHelpful: r.voted, helpfulCount: x.helpfulCount + (r.voted ? 1 : -1) } : x)) });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const max = Math.max(1, ...breakdown.map((b) => b.count));

  return (
    <section id="reviews" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl md:text-3xl">Ratings & reviews</h2>
        {status === 'authed' ? (
          <button onClick={() => setWriting(true)} className="btn btn-outline btn-sm">
            {eligible?.hasReviewed ? 'Edit your review' : 'Write a review'}
          </button>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(pathname + '#reviews')}`} className="btn btn-outline btn-sm">
            Sign in to review
          </Link>
        )}
      </div>

      {ratingCount > 0 && (
        <div className="mt-6 grid gap-6 rounded-[var(--radius)] bg-surface p-6 ring-1 ring-line sm:grid-cols-[180px_1fr]">
          <div>
            <div className="font-display text-6xl font-bold leading-none">{ratingAvg.toFixed(1)}</div>
            <Stars value={ratingAvg} size={18} className="mt-2" />
            <div className="mt-1 text-sm text-muted">{ratingCount} verified ratings</div>
          </div>
          <div className="space-y-1.5">
            {breakdown.map((b) => (
              <button
                key={b.rating}
                onClick={() => {
                  setRating(rating === b.rating ? null : b.rating);
                  setPage(1);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-1 text-sm ${rating === b.rating ? 'bg-tile' : 'hover:bg-tile'}`}
                aria-pressed={rating === b.rating}
              >
                <span className="flex w-8 items-center gap-0.5 font-medium">
                  {b.rating} <Star size={12} className="text-marigold" fill="currentColor" />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-tile">
                  <span className="block h-full rounded-full bg-marigold" style={{ width: `${(b.count / max) * 100}%` }} />
                </span>
                <span className="w-8 text-right text-muted tabular-nums">{b.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          <span className="text-muted">
            {data.total} {rating ? `${rating}-star ` : ''}reviews
          </span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-full border-[1.5px] border-line bg-surface px-3 text-sm"
            aria-label="Sort reviews"
          >
            <option value="helpful">Most helpful</option>
            <option value="recent">Newest</option>
            <option value="rating_high">Highest rated</option>
            <option value="rating_low">Lowest rated</option>
          </select>
        </div>
      )}

      <div className="mt-4 divide-y divide-line">
        {data?.items.map((r) => (
          <article key={r.id} className="py-5">
            <div className="flex items-center gap-3">
              <Stars value={r.rating} size={14} />
              {r.title && <h3 className="font-sans text-[15px] font-semibold">{r.title}</h3>}
            </div>
            {r.body && <p className="mt-2 text-[15px] text-ink/85">{r.body}</p>}
            {r.adminReply && (
              <div className="mt-3 flex gap-2 rounded-[var(--radius-sm)] bg-tile p-3 text-sm">
                <MessageSquareQuote size={16} className="mt-0.5 shrink-0 text-peacock" />
                <div>
                  <b>Response from the store:</b> {r.adminReply}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="font-medium text-ink">{r.user.name}</span>
              {r.isVerifiedPurchase && (
                <span className="inline-flex items-center gap-1 text-peacock">
                  <BadgeCheck size={13} /> Verified purchase
                </span>
              )}
              <span>{date(r.createdAt)}</span>
              <button onClick={() => vote(r.id)} className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${r.votedHelpful ? 'bg-ink text-white ring-ink' : 'ring-line hover:ring-ink'}`}>
                <ThumbsUp size={12} /> Helpful ({r.helpfulCount})
              </button>
            </div>
          </article>
        ))}
      </div>
      {data && data.total === 0 && <Empty title="No reviews yet" body="Bought this? Your review helps other shoppers decide." />}
      {data && data.page < data.totalPages && (
        <button onClick={() => setPage((p) => p + 1)} className="btn btn-outline mt-2">
          Show more reviews
        </button>
      )}

      <WriteReview
        open={writing}
        onClose={() => setWriting(false)}
        productId={productId}
        verified={eligible?.verifiedPurchase}
        onDone={() => {
          setPage(1);
          void load();
          setEligible((e) => (e ? { ...e, hasReviewed: true } : e));
        }}
      />
    </section>
  );
}

function WriteReview({ open, onClose, productId, verified, onDone }: { open: boolean; onClose: () => void; productId: string; verified?: boolean; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return toast.error('Choose a star rating');
    setBusy(true);
    try {
      const r = await api<{ message: string }>(`/products/${productId}/reviews`, { body: { rating, title: title || undefined, body: body || undefined } });
      toast.success(r.message);
      onClose();
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Write a review" side="center" width="max-w-lg">
      <form onSubmit={submit} className="space-y-4 p-5">
        {verified && (
          <p className="flex items-center gap-1.5 text-sm text-peacock">
            <BadgeCheck size={16} /> Your review will show a verified purchase badge
          </p>
        )}
        <div>
          <div className="label">Your rating</div>
          <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
                <Star size={30} className={(hover || rating) >= n ? 'text-marigold' : 'text-line'} fill="currentColor" strokeWidth={0} />
              </button>
            ))}
            <span className="ml-2 text-sm font-medium text-muted">{labels[hover || rating]}</span>
          </div>
        </div>
        <label className="block">
          <span className="label">Headline</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="What stood out?" />
        </label>
        <label className="block">
          <span className="label">Review</span>
          <textarea className="field" rows={5} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} placeholder="Quality, fit, how you use it…" />
        </label>
        <button disabled={busy} className="btn btn-primary w-full">
          {busy ? <Spinner /> : 'Post review'}
        </button>
      </form>
    </Sheet>
  );
}
