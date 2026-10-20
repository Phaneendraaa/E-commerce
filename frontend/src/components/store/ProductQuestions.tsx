'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { Spinner } from '@/components/ui';

interface Q {
  id: string;
  question: string;
  answer: string | null;
  createdAt: string;
  user: { name: string };
}

export function ProductQuestions({ productId }: { productId: string }) {
  const status = useAuth((s) => s.status);
  const [items, setItems] = useState<Q[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: Q[] }>(`/products/${productId}/questions`)
      .then((r) => setItems(r.items))
      .catch(() => undefined);
  }, [productId]);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'authed') return toast('Sign in to ask a question');
    setBusy(true);
    try {
      const r = await api<{ question: Q }>(`/products/${productId}/questions`, { body: { question: text } });
      setItems((list) => [{ ...r.question, user: { name: 'You' } }, ...list]);
      setText('');
      toast.success('Question posted. We usually answer within a day.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="text-2xl md:text-3xl">Questions</h2>
      <form onSubmit={ask} className="mt-5">
        <label className="sr-only" htmlFor="ask">
          Ask a question
        </label>
        <textarea id="ask" rows={2} value={text} onChange={(e) => setText(e.target.value)} minLength={5} maxLength={500} required placeholder="Have a question about this product?" className="field" />
        <button disabled={busy || text.trim().length < 5} className="btn btn-outline btn-sm mt-2">
          {busy ? <Spinner size={14} /> : 'Ask'}
        </button>
      </form>
      <div className="mt-5 space-y-5">
        {items.slice(0, 6).map((q) => (
          <div key={q.id} className="text-sm">
            <p className="font-semibold">Q: {q.question}</p>
            {q.answer ? <p className="mt-1 text-ink/80">A: {q.answer}</p> : <p className="mt-1 text-muted">Awaiting an answer</p>}
            <p className="mt-1 text-xs text-faint">
              {q.user.name} · {timeAgo(q.createdAt)}
            </p>
          </div>
        ))}
        {!items.length && <p className="text-sm text-muted">No questions yet. Ask the first one.</p>}
      </div>
    </section>
  );
}
