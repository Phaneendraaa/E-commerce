'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';
import { useSignedIn } from '@/lib/useSignedIn';
import { AuthShell } from '@/components/store/AuthShell';
import { Spinner } from '@/components/ui';

function ForgotInner() {
  const signedIn = useSignedIn();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ message: string; devCode?: string }>('/auth/password/forgot', { body: { email } });
      setSent(true);
      toast.success(r.message);
      if (r.devCode) toast.info(`Development mode — your code is ${r.devCode}`, { duration: 15000 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ user: User }>('/auth/password/reset', { body: { email, code, password } });
      await signedIn(r.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle={sent ? `Enter the code we emailed to ${email} and choose a new password.` : 'We’ll email you a code to set a new password.'}>
      {!sent ? (
        <form onSubmit={send} className="space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <button disabled={busy} className="btn btn-primary btn-lg w-full">
            {busy ? <Spinner /> : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <label className="block">
            <span className="label">6-digit code</span>
            <input className="field text-center font-display text-xl tracking-[0.4em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />
          </label>
          <label className="block">
            <span className="label">New password</span>
            <input type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
          </label>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
          <button disabled={busy || code.length !== 6} className="btn btn-primary btn-lg w-full">
            {busy ? <Spinner /> : 'Save new password'}
          </button>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotInner />
    </Suspense>
  );
}
