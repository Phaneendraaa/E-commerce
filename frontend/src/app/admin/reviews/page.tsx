'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { BadgeCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { date, timeAgo } from '@/lib/format';
import { Loading, PageHeader, Pager, Panel, useApi } from '@/components/admin/kit';
import { Badge, Img, Stars } from '@/components/ui';

function Reviews() {
  const [status, setStatus] = useState('PENDING');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const { data, reload } = useApi<any>('/admin/reviews', { status, rating, page, limit: 15 });
  const [reply, setReply] = useState<Record<string, string>>({});

  const update = async (id: string, body: Record<string, unknown>, msg: string) => {
    try {
      await api(`/admin/reviews/${id}`, { method: 'PATCH', body });
      toast.success(msg);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', ''].map((s) => (
          <button key={s} data-active={status === s} onClick={() => (setStatus(s), setPage(1))} className="chip">
            {s ? s[0] + s.slice(1).toLowerCase() : 'All'}
          </button>
        ))}
        <select value={rating} onChange={(e) => (setRating(e.target.value), setPage(1))} className="field !h-[34px] !w-auto text-sm" aria-label="Rating">
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} stars
            </option>
          ))}
        </select>
      </div>
      {!data ? (
        <Loading />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-line">
            {data.items.map((r: any) => (
              <li key={r.id} className="flex flex-wrap gap-4 p-5">
                <Link href={`/product/${r.product.slug}`} target="_blank" className="shrink-0">
                  <Img src={r.product.images[0]} alt="" className="size-14 rounded-md bg-tile object-cover" />
                </Link>
                <div className="min-w-[260px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} size={14} />
                    {r.title && <b className="text-sm">{r.title}</b>}
                    <Badge tone={r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'danger' : 'warn'}>{r.status.toLowerCase()}</Badge>
                  </div>
                  {r.body && <p className="mt-1.5 text-sm">{r.body}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <span>{r.user.name}</span>
                    {r.isVerifiedPurchase && (
                      <span className="inline-flex items-center gap-1 text-peacock">
                        <BadgeCheck size={12} /> Verified
                      </span>
                    )}
                    <span>on {r.product.name}</span>
                    <span>{date(r.createdAt)}</span>
                  </div>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void update(r.id, { adminReply: reply[r.id] ?? r.adminReply ?? '' }, 'Reply posted');
                    }}
                  >
                    <input value={reply[r.id] ?? r.adminReply ?? ''} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} placeholder="Public reply from the store (optional)" className="field !h-9 text-sm" aria-label="Reply" />
                    <button className="btn btn-outline btn-sm !h-9">Reply</button>
                  </form>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {r.status !== 'APPROVED' && (
                    <button onClick={() => update(r.id, { status: 'APPROVED' }, 'Review published')} className="btn btn-primary btn-sm">
                      Approve
                    </button>
                  )}
                  {r.status !== 'REJECTED' && (
                    <button onClick={() => update(r.id, { status: 'REJECTED' }, 'Review hidden')} className="btn btn-ghost btn-sm text-danger">
                      Reject
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!data.items.length && <p className="p-8 text-center text-sm text-muted">Nothing to moderate.</p>}
          <Pager page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />
        </Panel>
      )}
    </>
  );
}

function Questions() {
  const [unanswered, setUnanswered] = useState(true);
  const { data, reload } = useApi<{ questions: any[] }>('/admin/questions', { unanswered: unanswered ? 'true' : '' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <>
      <div className="mb-4 flex gap-2">
        <button data-active={unanswered} onClick={() => setUnanswered(true)} className="chip">
          Unanswered
        </button>
        <button data-active={!unanswered} onClick={() => setUnanswered(false)} className="chip">
          All
        </button>
      </div>
      {!data ? (
        <Loading />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-line">
            {data.questions.map((q) => (
              <li key={q.id} className="p-5">
                <div className="text-xs text-muted">
                  {q.user.name} asked about{' '}
                  <Link href={`/product/${q.product.slug}`} target="_blank" className="underline">
                    {q.product.name}
                  </Link>{' '}
                  · {timeAgo(q.createdAt)}
                </div>
                <p className="mt-1 font-semibold">{q.question}</p>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api(`/admin/questions/${q.id}`, { method: 'PATCH', body: { answer: answers[q.id] ?? q.answer } });
                      toast.success('Answer published');
                      reload();
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  }}
                >
                  <input value={answers[q.id] ?? q.answer ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Write an answer" className="field !h-9 text-sm" required aria-label="Answer" />
                  <button className="btn btn-primary btn-sm !h-9">{q.answer ? 'Update' : 'Answer'}</button>
                </form>
              </li>
            ))}
          </ul>
          {!data.questions.length && <p className="p-8 text-center text-sm text-muted">All questions are answered.</p>}
        </Panel>
      )}
    </>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') ?? 'reviews';
  return (
    <div>
      <PageHeader title="Reviews & Q&A" description="Approve reviews, reply publicly and answer shopper questions" />
      <div className="mb-5 flex gap-2" role="tablist">
        {[
          ['reviews', 'Reviews'],
          ['questions', 'Questions'],
        ].map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} data-active={tab === id} onClick={() => router.replace(`/admin/reviews?tab=${id}`)} className="chip">
            {l}
          </button>
        ))}
      </div>
      {tab === 'questions' ? <Questions /> : <Reviews />}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
