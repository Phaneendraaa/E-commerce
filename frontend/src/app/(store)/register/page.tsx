'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';
import { useSignedIn } from '@/lib/useSignedIn';
import { AuthShell } from '@/components/store/AuthShell';
import { GoogleButton } from '@/components/store/GoogleButton';
import { Spinner } from '@/components/ui';

function RegisterInner() {
  const signedIn = useSignedIn();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', referralCode: params.get('ref') ?? '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const r = await api<{ user: User }>('/auth/register', { body: { ...form, phone: form.phone || undefined, referralCode: form.referralCode || undefined } });
      await signedIn(r.user, { isNew: true });
    } catch (err) {
      const fields = err instanceof ApiError ? (err.details as Record<string, string[]> | undefined) : undefined;
      setErrors(fields ? Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v[0]])) : { form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Takes 30 seconds. Get 10% off your first order with WELCOME10.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <label className="block">
          <span className="label">Full name</span>
          <input className="field" value={form.name} onChange={set('name')} required autoComplete="name" aria-invalid={Boolean(errors.name)} />
          {errors.name && <span className="mt-1 block text-xs text-danger">{errors.name}</span>}
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input className="field" type="email" value={form.email} onChange={set('email')} required autoComplete="email" aria-invalid={Boolean(errors.email)} />
          {errors.email && <span className="mt-1 block text-xs text-danger">{errors.email}</span>}
        </label>
        <label className="block">
          <span className="label">
            Mobile number <span className="font-normal text-muted">(for WhatsApp order updates)</span>
          </span>
          <input className="field" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="98765 43210" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="field" type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" aria-invalid={Boolean(errors.password)} />
          <span className={`mt-1 block text-xs ${errors.password ? 'text-danger' : 'text-muted'}`}>{errors.password ?? 'At least 8 characters'}</span>
        </label>
        <label className="block">
          <span className="label">
            Referral code <span className="font-normal text-muted">(optional)</span>
          </span>
          <input className="field uppercase" value={form.referralCode} onChange={set('referralCode')} maxLength={20} />
        </label>
        {errors.form && (
          <p role="alert" className="text-sm font-medium text-danger">
            {errors.form}
          </p>
        )}
        <button disabled={busy} className="btn btn-primary btn-lg w-full">
          {busy ? <Spinner /> : 'Create account'}
        </button>
        <p className="text-xs text-muted">
          By continuing you agree to our{' '}
          <Link href="/pages/terms" className="underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/pages/privacy-policy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
      <GoogleButton onSignedIn={(u) => signedIn(u, { isNew: true })} />
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href={`/login${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-semibold text-ink underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  );
}
