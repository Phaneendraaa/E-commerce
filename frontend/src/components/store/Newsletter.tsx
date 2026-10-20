'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ message: string }>('/cms/newsletter', { body: { email } });
          toast.success(r.message);
          setEmail('');
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="sr-only" htmlFor="newsletter-email">
        Email address
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="h-11 min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-white/50 outline-none focus:border-marigold"
      />
      <button disabled={busy} className="btn btn-accent">
        Subscribe
      </button>
    </form>
  );
}
